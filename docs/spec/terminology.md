---
type: spec
status: Accepted
updated: 2026-11-26
---

# 统一业务术语

## 用法

文档和界面使用下表术语。接口标识列引用对应的契约字段、条件、类型或能力。没有单一接口标识的概念用“—”表示。界面按语言清单翻译业务概念。

| 标准中文 | English | 接口标识 | 定义 | 替代表述 |
| --- | --- | --- | --- | --- |
| 有效校园资格 | Campus eligibility | `campus_eligibility` | 普通认证、已认证校友或未过期临时新生所提供的当前资格 | 有效学生资格、学生认证通过、已认证学生 |
| 学生认证 | Student verification | — | 核验学习经历和身份归属的流程及结果 | — |
| 独立实名 | Identity verification | `identity_verified` | 独立的实名核验结果 | — |
| 学校数据认证 | School data authorization | `school_data_authorization` | 校园身份持有人单独授权平台读取本人学校数据，可随时撤销 | — |
| 评价选课状态 | Review enrollment status | `enrollment_status` | 发布快照。enrolled 表示有记录，not_enrolled 表示获准完整读取后无匹配记录，unknown 表示未知 | — |
| 选课记录 | Course enrollment | `course_enrollment` | 从获准教务来源取得的本人课程与任课关系 | — |
| 任课教师 | Course instructor | `Enrollment.teacher_ids` | 本人某次选课实际关联的授课教师 | — |
| 教学班 | Teaching class | `Enrollment.class_id` | 学期开课下的班级及授课来源对象 | — |
| 能力 | Capability | `capability` | 模块提供的功能或允许执行的操作 | — |
| 授权范围 | Authorization scope | — | 管理员或应用获准操作的对象集合 | — |
| 资料访问权 | Resource entitlement | — | 管理权限、单独授权、群体权益或购买提供的下载依据 | — |
| 可下载 | Download allowed | `download_allowed` | 根据当前身份、授权来源和资料状态得出的访问结果 | — |
| 积分 | Points | `points` | 按独立账户管理的整数额度 | — |
| Ivory | Ivory | `ivory_minor` | 站内余额计价单位，接口使用整数最小单位，显示保留两位小数 | — |
| 修订号 | Revision | `revision` | 同一业务对象单调递增的状态版本 | — |
| 数据密级 | Data classification | `Protection.class` | 内容敏感程度及存储保护要求，独立于平台下载访问条件 | — |
| 云盘 | Cloud drive | — | 用户可通过账号使用的云端文件存储，托管与容量贡献分别授权 | 网盘 |
| 云盘容量 | Cloud drive capacity | `provider_capacity` | 供应商观测的总空间、已用和剩余空间，仅在本人贡献 API 返回 | — |
| 仅账务 | Ledger-only | `billing.ledger-only` | 钱包和账务记录可读，支付与商品交易入口关闭的运行模式 | — |
| 存储实例 | Storage instance | `Instance` | 由供应商账号、凭据引用和受限根目录组成的接入单元 | — |
| 存储副本 | Storage replica | — | 同一逻辑对象版本在某个存储实例上的物理内容 | — |
| 故障域 | Failure domain | `account_domain`、`owner_domain` | 可能共同失效的一组资源，例如同一账号或同一贡献者控制的账号 | — |

OIDC `scope` 表示身份协议中的请求范围；业务授权范围按业务接口表达。数据库 `schema`、事务 `outbox` 和事件 `revision` 保留技术含义。术语检查针对当前仓库文档正文中的替代表述，术语表自身保留用于检查的映射。
