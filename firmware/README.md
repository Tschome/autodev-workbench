# 固件资源

这里发布的是 AutoDev Workbench 烧录器使用的启动资源包（config.cfg、spl.bin、uboot.bin）。

- 资源版本：v0.1.0
- 发布通道：preview
- 当前不包含 rootfs、系统分区镜像、完整 OTA 镜像或签名文件。
- 下载前请按目标芯片、板卡和硬件版本核对 manifest.json，并校验同目录的 sha256.txt。
- 这些文件用于 Workbench 的 Cloner runtime；不能据此推断整机系统升级已完成。
