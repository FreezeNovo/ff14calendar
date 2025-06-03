# koishi-plugin-ff14calendar

[![npm](https://img.shields.io/npm/v/koishi-plugin-ff14calendar?style=flat-square)](https://www.npmjs.com/package/koishi-plugin-ff14calendar)

一个适用于 [Koishi](https://koishi.chat/) 的 FFXIV 日历推送插件，也支持其他 Webcal/ics 日历订阅，自动推送和手动查询活动，兼容 QQ（OneBot）、Discord 等多平台。

## 功能特性

- 支持定时自动推送 FFXIV 活动日历到指定频道/群
- 支持手动指令查询最近活动
- 支持 Webcal/ics 日历格式
- 支持代理访问日历源
- 多平台适配（如 QQ、Discord）

## 配置示例

建议直接在 Koishi 控制台插件管理界面配置。

## 指令

- `webcal.today` 或 `最近活动`  
  查询最近的日历活动事项。

## 代理支持

如需通过代理访问日历源，请在配置中填写 `proxy` 字段（支持 http/https 代理）。

## 贡献

欢迎 Issue 和 PR！

## License

MIT


