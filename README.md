# 踩缝纫机

一个考验手脚协调性的 H5 缝纫小游戏。

- 桌面端：WASD 控制布料方向，交替按住 J / K 踩踏板。
- 手机端：按住衣服滑动方向，交替点击 J / K。
- 线上地址：https://cassiangroup.uk/sewing/

项目是纯静态页面，直接打开 `index.html` 或使用任意静态文件服务器即可运行。

线上排行榜保存在 `/opt/sewing/data/leaderboard.json`。Nginx 将它映射到
`/sewing/data/leaderboard.json`，并通过内置 WebDAV 模块接受同源 `PUT` 更新。
数据目录位于部署同步目录之外，因此发布新版本不会清空 Top 100。
