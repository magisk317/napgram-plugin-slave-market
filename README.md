# 大牛马时代 🐂🐎

一个基于 NapGram 的群聊经济养成游戏插件

## 功能特点

### 🎮 核心玩法
- **牛马市场**: 购买、放生、赎身、抢夺其他玩家
- **打工赚钱**: 稳定的收入来源，牛马为主人贡献分成
- **种地系统**: 多地块管理，8种作物，收益丰富
- **抢劫对抗**: 风险与收益并存，支持3种策略（稳健/平衡/激进）

### 💰 经济系统
- **银行系统**: 存款、取款、自动利息计算
- **贷款系统**: 根据信用等级贷款，支持分期还款
- **转账交易**: 玩家间转账，支持红包功能
- **信用等级**: 提升等级扩大存款上限和贷款额度

### 🛡️ 防护与特权
- **保镖系统**: 雇佣保镖防止被抢劫，4种等级可选
- **VIP 会员**: 转账免手续费、专属福利
- **装扮系统**: 个性化外观展示（待实现）

### 📊 社交互动
- **排行榜**: 身价、资产、牛马数量排行
- **红包系统**: 发红包、抢红包，手气最佳奖励
- **成就系统**: 丰富的成就体系（待实现）

## 快速开始

### 安装

```bash
# 使用 npm
npm install napgram-plugin-slave-market

# 使用 pnpm
pnpm add napgram-plugin-slave-market
```

### 配置

在 NapGram 配置文件中启用插件：

```yaml
# plugins.yaml
plugins:
  - name: slave-market
    enabled: true
    config:
      初始余额: 100
      初始身价: 100
      调试日志: false
      管理员列表: []
      VIP配置:
        启用: true
        管理员永久VIP: true
```

### 数据库配置

确保 `DATABASE_URL` 环境变量已设置：

```bash
export DATABASE_URL="postgresql://user:password@localhost:5432/napgram"
```

运行 Prisma 迁移：

```bash
cd packages/napgram-plugin-slave-market
npx prisma migrate dev
```

### 使用

在群聊中发言即可自动注册，输入 `我的信息` 查看状态。

## 命令列表

### 基础命令 (4个)
- `注册` - 新玩家注册
- `我的信息` / `个人信息` - 查看个人资料
- `玩家帮助` / `帮助` - 查看完整帮助
- `重开` - 清空数据重新开始

### 经济命令 (11个)
- `打工` - 工作赚钱（冷却2分钟）
- `监狱打工` / `踩缝纫机` - 服刑期间赚钱
- `抢劫 [@用户] [策略]` - 抢劫其他玩家（冷却1分钟）
  - 策略：稳健（80%/20%）、平衡（50%/30%）、激进（30%/50%）
- `转账 [@用户] <金额>` - 转账给其他玩家（手续费5%）
- `存款 <金额>` - 存入银行
- `取款 <金额>` - 从银行取出
- `领取利息` - 领取存款利息（每小时1%）
- `银行信息` / `银行` - 查看银行账户
- `升级信用` - 提升信用等级
- `贷款 <金额>` - 申请贷款
- `还款 <金额>` - 偿还贷款

### 牛马市场 (6个)
- `牛马市场` / `市场` - 查看可购买玩家
- `我的牛马` / `牛马列表` - 查看拥有的牛马
- `购买玩家 [@用户]` - 购买指定玩家（冷却5分钟）
- `放生 [@用户]` - 解除雇佣关系
- `赎身` - 支付赎金获得自由（身价x1.2）
- `抢牛马 [@用户]` - 强制抢夺（2倍价格）

### 种地系统 (4个)
- `开地` - 购买新地块（最多10块）
- `种地 [作物] [地块]` - 种植作物
  - 作物：小麦、玉米、土豆、胡萝卜、番茄、黄瓜、茄子、辣椒
- `收获` - 收获所有成熟作物
- `地块状态` / `农场` - 查看农场状态

### 保镖系统 (3个)
- `保镖市场` / `保镖列表` - 查看可雇佣的保镖
- `雇佣保镖 <名称>` - 雇佣指定保镖
  - 普通保镖（30分钟）、精英保镖（1小时）、专业保镖（2小时）、贴身保镖（6小时）
- `保镖状态` - 查看当前保镖状态

### VIP系统 (3个)
- `生成vip卡 <类型> <数量> [小时]` - 生成VIP卡密（仅管理员）
  - 类型：日卡、周卡、月卡、小时卡
- `vip兑换 <卡密>` - 兑换VIP卡密
- `vip状态` / `vip` - 查看VIP状态

### 红包系统 (2个)
- `发红包 <金额> <份数>` - 发送群红包（手续费5%）
- `抢红包 <红包ID>` / `抢` - 抢红包

### 排行榜 (3个)
- `身价排行` / `worth` - 查看身价TOP10
- `资金排行` / `asset` - 查看资产TOP10（余额+存款）
- `牛马排行` / `slaves` - 查看牛马数量TOP10

### 管理员命令 (8个)
- `添加管理员 [@用户]` - 添加管理员
- `移除管理员 [@用户]` - 移除管理员
- `系统统计` / `stats` - 查看系统统计
- `重置游戏` - 清空所有游戏数据
- `清理数据` - 清理过期数据
- `给钱 [@用户] <金额>` - 给玩家加钱
- `禁用玩家 [@用户]` - 禁用玩家命令
- `解禁玩家 [@用户]` - 解禁玩家命令

**总计**: 44个命令

## 配置说明

查看 [IMPLEMENTATION_PLAN.md](./IMPLEMENTATION_PLAN.md) 了解完整配置项。

### 核心配置

```typescript
{
  初始余额: 100,              // 新玩家初始余额
  初始身价: 100,              // 新玩家初始身价
  初始存款上限: 1000,         // 初始银行存款上限
  管理员列表: [],             // 管理员 userId 或平台原始ID
  
  打工收益比例: 0.1,          // 打工收入 = 身价 * 10%
  抢劫收益比例: 0.3,          // 抢劫最多抢30%余额
  存款利率: 0.01,             // 每小时1%利息
  转账手续费: 0.05,           // 转账手续费5%
  
  冷却时间: {
    打工: 120000,             // 2分钟
    抢劫: 60000,              // 1分钟
    转账: 120000,             // 2分钟
    购买: 300000,             // 5分钟
    种地: 30000,              // 30秒
    收获: 10000,              // 10秒
  }
}
```

## 开发

### 构建

```bash
npm run build
```

### 开发模式

```bash
npm run dev
```

### 测试

```bash
npm test
```

### 类型检查

```bash
npm run typecheck
```

## 数据库结构

插件使用以下数据表：

- `slave_market_players` - 玩家信息
- `slave_market_transactions` - 交易记录
- `slave_market_farm_lands` - 地块信息
- `slave_market_appearances` - 装扮（待实现）
- `slave_market_red_packets` - 红包
- `slave_market_red_packet_grabs` - 红包领取记录
- `slave_market_vip_cards` - VIP卡密
- `slave_market_system` - 系统配置
- `slave_market_admins` - 管理员列表

## 贡献指南

欢迎提交 Issue 和 Pull Request！

### 开发流程

1. Fork 本仓库
2. 创建特性分支 (`git checkout -b feature/AmazingFeature`)
3. 提交更改 (`git commit -m 'feat: Add some AmazingFeature'`)
4. 推送到分支 (`git push origin feature/AmazingFeature`)
5. 开启 Pull Request

### 代码规范

- 使用 TypeScript 严格模式
- 遵循 ESLint 规则
- 提交信息遵循 [Conventional Commits](https://www.conventionalcommits.org/)

## 许可证

MIT License

## 致谢

本插件灵感来源于 [koishi-plugin-slave-market-rework](https://github.com/example/koishi-plugin-slave-market-rework)

---

**版本**: 1.0.0  
**维护**: NapGram Team  
**文档**: [GitHub Wiki](https://github.com/magisk317/napgram-plugin-slave-market/wiki)
