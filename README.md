# @gloryfham/mcp-global-planner

荣耀全球路径规划师 — 联动保险、移民签证与信托传承的家庭未来规划智能助手。

## 核心理念

不是简单地从产品库里搜产品，而是把保险、移民签证与信托传承放进同一张"家庭未来规划地图"里。当客户提出子女教育、身份配置、家庭保障、财富传承、跨境生活安排等需求时，输出**路径级答案**——先解决身份、同步补齐保障、再进入落地材料清单与顾问跟进节点。

## 安装

```bash
npm install -g @gloryfham/mcp-global-planner
```

## 使用

### 作为 Claude Code Skill

```bash
npx skills add gloryfham/agent-skills
```

### 作为独立 MCP Server

```bash
npx @gloryfham/mcp-global-planner
```

## 可用工具

### 保险产品查询

| 工具 | 参数 | 描述 |
|------|------|------|
| `listInsuranceProducts` | 无 | 获取所有保险产品列表 |
| `searchInsuranceProducts(keyword?, productType?, region?)` | 全部可选 | 搜索保险产品 |
| `getInsuranceProductDetail(productCode)` | productCode(必填) | 获取产品详情 |

### 签证/移民项目查询

| 工具 | 参数 | 描述 |
|------|------|------|
| `listVisaProjectTypes` | 无 | 获取所有项目类型分类 |
| `listAllVisaProjects` | 无 | 获取所有签证/移民项目列表 |
| `searchVisaProjects(keyword?, country?, projectType?, identityType?, minAmount?)` | 全部可选 | 搜索签证/移民项目 |
| `getVisaProjectDetail(projectCode)` | projectCode(必填) | 获取项目详情 |

### 信托产品查询

| 工具 | 参数 | 描述 |
|------|------|------|
| `listTrustServiceTypes` | 无 | 获取信托服务类型分类（家族信托、员工信托、海外公司秘书服务） |
| `listTrustJurisdictions` | 无 | 获取所有司法管辖区及法律特征对比 |
| `getTrustJurisdictionDetail(jurisdictionCode)` | jurisdictionCode(必填) | 获取司法管辖区详情 |
| `listTrustProducts` | 无 | 获取所有信托产品列表 |
| `searchTrustProducts(keyword?, serviceType?, jurisdiction?, jurisdictionCode?)` | 全部可选 | 搜索信托产品 |
| `getTrustProductDetail(productCode)` | productCode(必填) | 获取信托产品详情 |

**信托服务类型**：
- `家族信托` — 香港家族信托、新加坡家族信托
- `员工信托` — 上市前/后员工信托服务
- `海外公司秘书服务` — BVI、开曼、塞舌尔等离岸公司服务

**信托司法管辖区**：
- `HK` — 香港（普通法，永久期限）
- `SG` — 新加坡（普通法，100年期限）
- `BVI` — 英属维尔京群岛（离岸金融中心）
- `KY` — 开曼群岛（离岸金融中心）
- `SC` — 塞舌尔群岛（离岸金融中心）

### 核心：路径规划

| 工具 | 描述 |
|------|------|
| **`generateFamilyPathPlan`** | 根据家庭情况生成身份规划与保险保障的联动路径建议 |

`generateFamilyPathPlan` 参数：
- `primaryGoal` (必填) — 主要目标：`identity`(身份配置) | `insurance`(保障优先) | `education`(子女教育) | `retirement`(养老规划) | `comprehensive`(全面规划)
- `targetCountries` (可选) — 目标国家/地区列表
- `familyStructure` (可选) — 家庭结构描述
- `timeWindow` (可选) — 期望完成时间窗口
- `hasExistingVisa` (可选) — 是否已有海外身份
- `hasExistingInsurance` (可选) — 是否已有商业保险
- `budget` (可选) — 预算范围

## License

MIT
