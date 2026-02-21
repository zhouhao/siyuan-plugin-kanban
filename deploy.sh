#!/bin/bash
TARGET="~/SiYuan/data/plugins/siyuan-plugin-kanban"
pnpm build && cp -f index.js index.css "$TARGET/"
echo "Deployed to $TARGET"
