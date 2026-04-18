import { McpServer } from '@modelcontextprotocol/sdk/server/mcp.js';
import { StdioServerTransport } from '@modelcontextprotocol/sdk/server/stdio.js';
import { z } from 'zod';
import { readFileSync } from 'fs';
import { fileURLToPath } from 'url';
import { dirname, join } from 'path';

const __filename = fileURLToPath(import.meta.url);
const __dirname = dirname(__filename);

// ============================================================
// 数据加载
// ============================================================

// 加载保险产品数据
const insuranceRaw = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'insurance.json'), 'utf-8')
);
const insuranceProducts = insuranceRaw.response?.r || [];
const insuranceMap = {};
insuranceProducts.forEach(p => {
  insuranceMap[p.salesPlanCode] = p;
});

// 加载签证项目数据
const visaRaw = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'visa.json'), 'utf-8')
);
const visaProjectTypes = visaRaw.data || [];
const allVisaProjects = [];
const visaMap = {};

visaProjectTypes.forEach(pt => {
  (pt.projectInfoList || []).forEach(project => {
    const enriched = {
      ...project,
      projectType: pt.projectType,
      projectTypeDesc: pt.projectTypeDesc,
    };
    allVisaProjects.push(enriched);
    visaMap[project.projectCode] = enriched;
  });
});

// 加载信托产品数据
const trustRaw = JSON.parse(
  readFileSync(join(__dirname, '..', 'data', 'trust.json'), 'utf-8')
);
const trustServiceTypes = trustRaw.serviceTypes || [];
const trustJurisdictions = trustRaw.jurisdictions || [];
const trustEmployeeMarkets = trustRaw.employeeTrustMarkets || [];

// 扁平化所有信托产品
const allTrustProducts = [];
const trustProductMap = {};

// 家族信托 + 公司秘书服务
trustJurisdictions.forEach(j => {
  (j.trustProducts || []).forEach(product => {
    const enriched = {
      ...product,
      jurisdiction: j.name,
      jurisdictionCode: j.code,
      serviceType: product.productType === '海外公司秘书服务' ? '海外公司秘书服务' : '家族信托',
    };
    allTrustProducts.push(enriched);
    trustProductMap[product.productCode] = enriched;
  });
});

// 员工信托
trustEmployeeMarkets.forEach(m => {
  const product = {
    productCode: m.productCode,
    productName: m.productName,
    productType: m.productType,
    serviceType: '员工信托',
    jurisdiction: m.market,
    jurisdictionCode: m.market === '香港' ? 'HK' : m.market === '美国' ? 'US' : 'SG',
    description: m.description,
    services: m.services,
  };
  allTrustProducts.push(product);
  trustProductMap[m.productCode] = product;
});

// ============================================================
// 关键词匹配
// ============================================================

function matchesInsurance(product, keyword) {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return (
    (product.salesPlanName || '').toLowerCase().includes(kw) ||
    (product.salesPlanNameEn || '').toLowerCase().includes(kw) ||
    (product.salesPlanShortName || '').toLowerCase().includes(kw) ||
    (product.salesPlanLabel || '').toLowerCase().includes(kw) ||
    (product.companyCode || '').toLowerCase().includes(kw)
  );
}

function matchesVisa(project, keyword) {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return (
    (project.projectName || '').toLowerCase().includes(kw) ||
    (project.country || '').toLowerCase().includes(kw) ||
    (project.investType || '').toLowerCase().includes(kw) ||
    (project.projectManager || '').toLowerCase().includes(kw) ||
    (project.projectTypeDesc || '').toLowerCase().includes(kw) ||
    (project.identityType || '').toLowerCase().includes(kw)
  );
}

function matchesTrust(product, keyword) {
  if (!keyword) return true;
  const kw = keyword.toLowerCase();
  return (
    (product.productName || '').toLowerCase().includes(kw) ||
    (product.productCode || '').toLowerCase().includes(kw) ||
    (product.jurisdiction || '').toLowerCase().includes(kw) ||
    (product.jurisdictionCode || '').toLowerCase().includes(kw) ||
    (product.productType || '').toLowerCase().includes(kw) ||
    (product.serviceType || '').toLowerCase().includes(kw) ||
    (product.description || '').toLowerCase().includes(kw) ||
    (product.features || []).some(f => f.toLowerCase().includes(kw))
  );
}

// ============================================================
// 路径规划引擎
// ============================================================

/**
 * 根据客户需求标签，推荐相关联的保险产品和签证项目
 * 返回结构化路径建议
 */
function generatePathRecommendation({
  targetCountries = [],
  familyStructure = '',
  timeWindow = '',
  hasExistingVisa = false,
  hasExistingInsurance = false,
  budget = '',
  primaryGoal = '', // 'identity' | 'insurance' | 'education' | 'retirement' | 'comprehensive'
}) {
  const recommendations = {
    pathSteps: [],
    insuranceSuggestions: [],
    visaSuggestions: [],
    trustSuggestions: [],
    priority: '',
    rationale: '',
  };

  // 1. 根据目标国家筛选签证项目
  let matchedVisas = allVisaProjects;
  if (targetCountries.length > 0) {
    matchedVisas = allVisaProjects.filter(v =>
      targetCountries.some(c => (v.country || '').toLowerCase().includes(c.toLowerCase()))
    );
  }

  // 2. 根据主要目标确定优先级
  if (primaryGoal === 'identity' || primaryGoal === 'comprehensive') {
    recommendations.priority = '身份先行，保障同步，传承布局';
    recommendations.rationale = '身份规划通常是家庭跨境配置的第一步，建议在启动身份申请的同时，同步搭建基础保障框架，并为财富传承做好信托架构准备。';

    // 身份类项目优先
    if (matchedVisas.length > 0) {
      recommendations.visaSuggestions = matchedVisas.slice(0, 5);
    }

    // 推荐与目标地区匹配的保险
    const targetRegions = new Set();
    matchedVisas.forEach(v => {
      const country = v.country || '';
      if (country.includes('香港') || country.includes('HK')) targetRegions.add('HK');
      if (country.includes('新加坡') || country.includes('SG')) targetRegions.add('SG');
      if (country.includes('美国') || country.includes('US')) targetRegions.add('US');
    });

    if (targetRegions.size > 0) {
      recommendations.insuranceSuggestions = insuranceProducts.filter(p =>
        targetRegions.has(p.placeToBelong)
      ).slice(0, 5);
    }

    // 推荐与目标地区匹配的信托产品
    const matchedTrusts = allTrustProducts.filter(t =>
      targetRegions.has(t.jurisdictionCode) || t.jurisdictionCode === 'BVI' || t.jurisdictionCode === 'KY'
    );
    recommendations.trustSuggestions = matchedTrusts.slice(0, 3);

    recommendations.pathSteps = [
      { step: 1, phase: '身份准备', action: '启动目标国家签证/居留申请流程', timeline: '第1-3个月' },
      { step: 2, phase: '保障搭建', action: '配置基础医疗、重疾、寿险，覆盖家庭主要风险', timeline: '第2-4个月' },
      { step: 3, phase: '传承布局', action: '根据资产规模选择家族信托架构，锁定财富传承方案', timeline: '第3-6个月' },
      { step: 4, phase: '教育规划', action: '根据子女年龄选择分红险/年金险作为教育金储备', timeline: '第3-6个月' },
      { step: 5, phase: '落地执行', action: '完成身份材料递交，保险保单生效，信托架构设立', timeline: '第6-12个月' },
    ];

  } else if (primaryGoal === 'insurance') {
    recommendations.priority = '保障优先，身份择机';
    recommendations.rationale = '如果家庭当前更关注风险保障和财富传承，可以先搭建保险架构，身份规划可在保障到位后择机启动。';

    recommendations.insuranceSuggestions = insuranceProducts.slice(0, 5);

    if (matchedVisas.length > 0) {
      recommendations.visaSuggestions = matchedVisas.slice(0, 3);
    }

    recommendations.pathSteps = [
      { step: 1, phase: '保障评估', action: '梳理家庭现有保障缺口，确定优先级', timeline: '第1个月' },
      { step: 2, phase: '保险配置', action: '选择匹配的产品方案，完成投保', timeline: '第1-3个月' },
      { step: 3, phase: '身份评估', action: '根据家庭跨境需求，评估身份规划必要性', timeline: '第3-6个月' },
      { step: 4, phase: '身份启动', action: '选择合适项目，开始身份申请', timeline: '第6个月后（视情况）' },
    ];

  } else if (primaryGoal === 'education') {
    recommendations.priority = '教育金储备 + 身份布局联动';
    recommendations.rationale = '子女教育是长期目标，建议通过保险锁定教育金，同时为目标留学国家提前布局身份。';

    // 推荐年金险/分红险
    recommendations.insuranceSuggestions = insuranceProducts.filter(p =>
      ['H01', 'H08'].includes(p.salesPlanType)
    ).slice(0, 5);

    // 推荐教育相关签证项目（如加拿大、新加坡、香港等）
    recommendations.visaSuggestions = allVisaProjects.filter(v =>
      ['加拿大', '新加坡', '香港', '美国'].some(c => (v.country || '').includes(c))
    ).slice(0, 3);

    recommendations.pathSteps = [
      { step: 1, phase: '教育目标确认', action: '确定目标留学国家、时间节点、预算', timeline: '第1个月' },
      { step: 2, phase: '教育金锁定', action: '通过年金险/分红险建立教育金储备', timeline: '第1-3个月' },
      { step: 3, phase: '身份预布局', action: '为目标国家选择合适身份路径', timeline: '第3-6个月' },
      { step: 4, phase: '持续跟进', action: '定期检视保障与身份进度', timeline: '每年' },
    ];

  } else if (primaryGoal === 'retirement') {
    recommendations.priority = '养老规划 + 宜居身份 + 传承架构';
    recommendations.rationale = '养老规划应尽早锁定长期稳定收益，同时考虑目标养老地的身份安排和财富传承架构。';

    // 推荐年金险/分红险
    recommendations.insuranceSuggestions = insuranceProducts.filter(p =>
      ['H01', 'H08'].includes(p.salesPlanType)
    ).slice(0, 5);

    // 推荐养老友好型国家
    recommendations.visaSuggestions = allVisaProjects.filter(v =>
      ['希腊', '西班牙', '马耳他', '泰国', '马来西亚'].some(c => (v.country || '').includes(c))
    ).slice(0, 3);

    // 推荐信托传承方案
    recommendations.trustSuggestions = allTrustProducts.filter(t =>
      t.productType === '家族信托'
    ).slice(0, 2);

    recommendations.pathSteps = [
      { step: 1, phase: '养老地选择', action: '评估目标养老地的医疗、生活成本、居住要求', timeline: '第1-2个月' },
      { step: 2, phase: '养老金锁定', action: '通过年金险/分红险建立稳定现金流', timeline: '第2-4个月' },
      { step: 3, phase: '传承架构', action: '设立家族信托，规划财富传承路径', timeline: '第4-6个月' },
      { step: 4, phase: '身份申请', action: '申请目标国家长期居留或永居', timeline: '第4-8个月' },
      { step: 5, phase: '落地准备', action: '税务规划、医疗保险衔接、信托运营', timeline: '第8-12个月' },
    ];
  }

  return recommendations;
}

// ============================================================
// MCP Server 定义
// ============================================================

const server = new McpServer({
  name: 'gloryfham-global-planner',
  version: '1.0.0',
});

// ---------- 保险产品工具 ----------

server.tool(
  'listInsuranceProducts',
  '获取所有可用保险产品的列表概览',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(insuranceProducts, null, 2) }],
  })
);

server.tool(
  'searchInsuranceProducts',
  '根据关键词、产品类型、地区搜索保险产品列表',
  {
    keyword: z.string().optional().describe('搜索关键词，支持产品名称、简称、标签模糊匹配'),
    productType: z.string().optional().describe('产品类型筛选，如 H01(分红险)/H08(年金险)/H09(IUL)'),
    region: z.string().optional().describe('产品地区筛选，如 HK(香港)/SG(新加坡)'),
  },
  async ({ keyword, productType, region }) => {
    const result = insuranceProducts.filter(p => {
      if (!matchesInsurance(p, keyword)) return false;
      if (productType && p.salesPlanType !== productType) return false;
      if (region && p.placeToBelong !== region) return false;
      return true;
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'getInsuranceProductDetail',
  '根据产品编号获取保险产品的完整详细信息',
  { productCode: z.string().describe('产品编号，如 PRU_PACE') },
  async ({ productCode }) => {
    const detail = insuranceMap[productCode];
    if (!detail) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `未找到保险产品: ${productCode}` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
    };
  }
);

// ---------- 签证项目工具 ----------

server.tool(
  'listVisaProjectTypes',
  '获取所有签证/移民项目的类型分类列表',
  {},
  async () => {
    const result = visaProjectTypes.map(pt => ({
      projectType: pt.projectType,
      projectTypeDesc: pt.projectTypeDesc,
      projectCount: (pt.projectInfoList || []).length,
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'listAllVisaProjects',
  '获取所有签证/移民项目的列表概览',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(allVisaProjects, null, 2) }],
  })
);

server.tool(
  'searchVisaProjects',
  '根据关键词、国家、项目类型、投资金额等搜索签证/移民项目',
  {
    keyword: z.string().optional().describe('搜索关键词，支持项目名称、国家、投资类型模糊匹配'),
    country: z.string().optional().describe('国家筛选，如 美国、加拿大、希腊、新加坡、香港'),
    projectType: z.string().optional().describe('项目类型筛选，如 传统国家、欧洲居留权、公民权、亚洲'),
    identityType: z.string().optional().describe('身份类型筛选，如 永久居民、永久居留卡、公民、长期居留签证'),
    minAmount: z.string().optional().describe('最低投资金额关键词，如 80万、25万欧'),
  },
  async ({ keyword, country, projectType, identityType, minAmount }) => {
    const result = allVisaProjects.filter(p => {
      if (!matchesVisa(p, keyword)) return false;
      if (country && !(p.country || '').toLowerCase().includes(country.toLowerCase())) return false;
      if (projectType && !(p.projectTypeDesc || '').toLowerCase().includes(projectType.toLowerCase())) return false;
      if (identityType && !(p.identityType || '').toLowerCase().includes(identityType.toLowerCase())) return false;
      if (minAmount && !(p.investAmountRequirement || '').toLowerCase().includes(minAmount.toLowerCase())) return false;
      return true;
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'getVisaProjectDetail',
  '根据项目编号获取签证/移民项目的完整详细信息',
  { projectCode: z.string().describe('项目编号，如 sg_prj_0001') },
  async ({ projectCode }) => {
    const detail = visaMap[projectCode];
    if (!detail) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `未找到签证项目: ${projectCode}` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
    };
  }
);

// ---------- 信托产品工具 ----------

server.tool(
  'listTrustServiceTypes',
  '获取信托服务的所有类型分类（家族信托、员工信托、海外公司秘书服务）',
  {},
  async () => {
    const result = trustServiceTypes.map(st => ({
      serviceType: st.serviceType,
      serviceTypeDesc: st.serviceTypeDesc,
      jurisdictions: st.jurisdictions || (st.subServices || []).flatMap(ss => ss.jurisdictions || []),
      subServices: st.subServices || null,
      services: st.services || null,
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'listTrustJurisdictions',
  '获取所有支持信托服务的司法管辖区及其法律特征对比',
  {},
  async () => {
    const result = trustJurisdictions.map(j => ({
      code: j.code,
      name: j.name,
      legalSystem: j.legalSystem,
      trustDuration: j.trustDuration,
      trusteeResidencyRequirement: j.trusteeResidencyRequirement,
      beneficiaryResidencyRequirement: j.beneficiaryResidencyRequirement,
      settlorRetainedPowers: j.settlorRetainedPowers,
      protector: j.protector,
      confidentiality: j.confidentiality,
      removeTrustee: j.removeTrustee,
      trusteeRegulation: j.trusteeRegulation,
    }));
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'getTrustJurisdictionDetail',
  '根据司法管辖区代码获取该地区的完整信托法律特征和产品信息',
  { jurisdictionCode: z.string().describe('司法管辖区代码，如 HK、SG、BVI、KY、SC') },
  async ({ jurisdictionCode }) => {
    const jurisdiction = trustJurisdictions.find(j => j.code === jurisdictionCode);
    if (!jurisdiction) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `未找到司法管辖区: ${jurisdictionCode}` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(jurisdiction, null, 2) }],
    };
  }
);

server.tool(
  'listTrustProducts',
  '获取所有可用信托产品的列表概览',
  {},
  async () => ({
    content: [{ type: 'text', text: JSON.stringify(allTrustProducts, null, 2) }],
  })
);

server.tool(
  'searchTrustProducts',
  '根据关键词、服务类型、司法管辖区搜索信托产品',
  {
    keyword: z.string().optional().describe('搜索关键词，支持产品名称、司法管辖区、服务类型、描述模糊匹配'),
    serviceType: z.string().optional().describe('服务类型筛选，如 家族信托、员工信托、海外公司秘书服务'),
    jurisdiction: z.string().optional().describe('司法管辖区筛选，如 香港、新加坡、英属维尔京群岛、开曼群岛、塞舌尔群岛'),
    jurisdictionCode: z.string().optional().describe('司法管辖区代码筛选，如 HK、SG、BVI、KY、SC'),
  },
  async ({ keyword, serviceType, jurisdiction, jurisdictionCode }) => {
    const result = allTrustProducts.filter(p => {
      if (!matchesTrust(p, keyword)) return false;
      if (serviceType && p.serviceType !== serviceType) return false;
      if (jurisdiction && !p.jurisdiction.toLowerCase().includes(jurisdiction.toLowerCase())) return false;
      if (jurisdictionCode && p.jurisdictionCode !== jurisdictionCode.toUpperCase()) return false;
      return true;
    });
    return {
      content: [{ type: 'text', text: JSON.stringify(result, null, 2) }],
    };
  }
);

server.tool(
  'getTrustProductDetail',
  '根据产品编号获取信托产品的完整详细信息',
  { productCode: z.string().describe('产品编号，如 HK_FT_001、SG_FT_001、BVI_OC_001') },
  async ({ productCode }) => {
    const detail = trustProductMap[productCode];
    if (!detail) {
      return {
        content: [{ type: 'text', text: JSON.stringify({ error: `未找到信托产品: ${productCode}` }) }],
        isError: true,
      };
    }
    return {
      content: [{ type: 'text', text: JSON.stringify(detail, null, 2) }],
    };
  }
);

// ---------- 路径规划工具（核心） ----------

server.tool(
  'generateFamilyPathPlan',
  '根据家庭情况生成身份规划与保险保障的联动路径建议。这是"荣耀全球路径规划师"的核心能力——将保险与移民签证放进同一张家庭未来规划地图。',
  {
    targetCountries: z.array(z.string()).optional().describe('目标国家/地区列表，如 ["美国", "香港"]'),
    familyStructure: z.string().optional().describe('家庭结构描述，如 "夫妻+1子女(8岁)"、"单身、35岁"'),
    timeWindow: z.string().optional().describe('期望完成时间窗口，如 "1年内"、"3-5年"'),
    hasExistingVisa: z.boolean().optional().describe('是否已持有目标国家签证/居留身份'),
    hasExistingInsurance: z.boolean().optional().describe('是否已有基础商业保险保障'),
    budget: z.string().optional().describe('预算范围描述，如 "年保费20-30万"、"总投资100万美元以内"'),
    primaryGoal: z.enum(['identity', 'insurance', 'education', 'retirement', 'comprehensive']).describe(
      '主要规划目标：identity(身份配置) | insurance(保障优先) | education(子女教育) | retirement(养老规划) | comprehensive(全面规划)'
    ),
  },
  async ({
    targetCountries = [],
    familyStructure = '',
    timeWindow = '',
    hasExistingVisa = false,
    hasExistingInsurance = false,
    budget = '',
    primaryGoal,
  }) => {
    const recommendation = generatePathRecommendation({
      targetCountries,
      familyStructure,
      timeWindow,
      hasExistingVisa,
      hasExistingInsurance,
      budget,
      primaryGoal,
    });

    return {
      content: [{
        type: 'text',
        text: JSON.stringify({
          context: {
            familyStructure,
            targetCountries,
            timeWindow,
            primaryGoal,
            budget,
          },
          ...recommendation,
        }, null, 2),
      }],
    };
  }
);

// ============================================================
// 启动
// ============================================================

async function main() {
  const transport = new StdioServerTransport();
  await server.connect(transport);
  console.error('Glory Global Planner MCP Server running on stdio');
}

main().catch(console.error);
