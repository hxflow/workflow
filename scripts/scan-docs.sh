#!/bin/bash
# 扫描项目中的 HTML 和 MD 文件，生成 docs.json

SCRIPT_DIR="$(cd "$(dirname "${BASH_SOURCE[0]}")" && pwd)"
PROJECT_ROOT="$(dirname "$SCRIPT_DIR")"
OUTPUT_FILE="$PROJECT_ROOT/docs.json"

echo "扫描文档目录..."

# 生成 JSON 文件
cat > "$OUTPUT_FILE" << 'EOF'
[
EOF

first=true

# 扫描函数
scan_dir() {
    local dir="$1"
    local base_path=""

    if [ "$dir" = "$PROJECT_ROOT" ]; then
        base_path=""
    else
        base_path="${dir#$PROJECT_ROOT/}"
    fi

    for item in "$dir"/*; do
        if [ -f "$item" ]; then
            local filename=$(basename "$item")
            local ext="${filename##*.}"
            local name="${filename%.*}"

            if [ "$ext" = "html" ] || [ "$ext" = "md" ]; then
                # 排除导航页面自身
                if [ "$filename" = "index.html" ] || [ "$filename" = "md-viewer.html" ]; then
                    continue
                fi
                
                local file_path
                if [ -z "$base_path" ]; then
                    file_path="$filename"
                else
                    file_path="$base_path/$filename"
                fi

                local category
                if [ -z "$base_path" ]; then
                    category="根目录"
                else
                    category="$base_path"
                fi

                local doc_type="md"
                if [ "$ext" = "html" ]; then
                    doc_type="html"
                fi

                if [ "$first" = true ]; then
                    first=false
                else
                    echo "," >> "$OUTPUT_FILE"
                fi

                cat >> "$OUTPUT_FILE" << EOF
  {
    "name": "$name",
    "path": "$file_path",
    "type": "$doc_type",
    "category": "$category"
  }
EOF
            fi
        elif [ -d "$item" ]; then
            local dirname=$(basename "$item")
            # 排除特定目录
            if [ "$dirname" != "node_modules" ] && [ "$dirname" != ".git" ] && [ "$dirname" != ".trae" ] && [ "$dirname" != "tests" ] && [ "$dirname" != "scripts" ]; then
                scan_dir "$item"
            fi
        fi
    done
}

scan_dir "$PROJECT_ROOT"

cat >> "$OUTPUT_FILE" << 'EOF'
]
EOF

echo "已生成 $OUTPUT_FILE"
echo "共扫描 $(grep -c '"name"' "$OUTPUT_FILE") 个文档"
