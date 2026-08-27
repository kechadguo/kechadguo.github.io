#!/bin/bash
# 生成 PWA 图标（使用 base64 编码的简单 SVG 转换）
# 使用 Python 生成不同尺寸的纯色 PNG 图标

cd "$(dirname "$0")"

for size in 72 96 128 144 152 192 384 512; do
  python3 -c "
import struct, zlib

def create_png(width, height, color):
    def chunk(chunk_type, data):
        c = chunk_type + data
        crc = struct.pack('>I', zlib.crc32(c) & 0xffffffff)
        return struct.pack('>I', len(data)) + c + crc

    header = b'\x89PNG\r\n\x1a\n'
    ihdr = chunk(b'IHDR', struct.pack('>IIBBBBB', width, height, 8, 2, 0, 0, 0))

    raw = b''
    for y in range(height):
        raw += b'\x00'
        for x in range(width):
            cx, cy = width//2, height//2
            r = width//2 - 4
            dist = ((x-cx)**2 + (y-cy)**2)**0.5
            if dist < r:
                raw += bytes(color)
            else:
                raw += b'\xff\xff\xff'

    idat = chunk(b'IDAT', zlib.compress(raw))
    iend = chunk(b'IEND', b'')

    return header + ihdr + idat + iend

png = create_png($size, $size, (74, 144, 217))
with open('icon-${size}.png', 'wb') as f:
    f.write(png)
print('Generated icon-${size}.png')
"
done
echo "All icons generated!"
