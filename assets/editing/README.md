# 切图素材说明

这个目录只用于手工切图，不会被游戏直接加载。所有 PNG 都保留原始尺寸，方便切好后按原坐标叠放。

## 目录

- `originals/sewing-machine-full.png`：完整缝纫机和桌面原图，尺寸 `1672 x 941`。
- `originals/prison-bars-full.png`：完整铁栅栏背景原图，尺寸 `1672 x 941`。
- `current-cuts/machine-arm-overlay.png`：现有机械臂透明切图，画布 `1672 x 941`。
- `current-cuts/needle-overlay.png`：现有针脚透明切图，画布 `1672 x 941`。
- `current-cuts/garment.png`：现有衣服透明素材，画布 `620 x 520`。
- `current-cuts/mantou.png`：现有馒头透明素材，画布 `1254 x 1254`。
- `replacements/`：把你重新切好的文件放在这里。

## 缝纫机建议切法

从 `originals/sewing-machine-full.png` 复制两份，保持画布为 `1672 x 941`，不要裁小画布，也不要改变位置。

1. 桌面层：保留桌面、台板和机器底座，擦掉位于衣服上方的机械臂、针杆和压脚，导出为 `replacements/sewing-machine-table.png`。
2. 机械臂层：只保留机器上半部、针杆、针、压脚和右侧机身，其余区域透明，导出为 `replacements/machine-arm-overlay.png`。
3. 针和压脚边缘建议保留约 `1 px` 的半透明抗锯齿，不要残留黑色或白色背景边。

游戏最终叠放顺序是：铁栅栏 -> 桌面层 -> 衣服 -> 机械臂层。两个缝纫机文件必须同尺寸、同坐标，叠放时才能完全重合。

## 交付给项目

切好后只需把两个文件放进 `replacements/`。不要覆盖 `originals/` 和 `current-cuts/`，这样随时可以对照或重做。
