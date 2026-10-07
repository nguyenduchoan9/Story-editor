# Story Editor

Prototype editor story 9:16.

- Upload ảnh
- Upload video và xem trước trên canvas
- Thêm chữ, sticker, kéo, resize, xoay, xóa layer
- Không có video: Export PNG 1080×1920
- Có video: Export MP4 ghép chữ, sticker và ảnh lên clip, giữ tiếng gốc, tải `story.mp4`

## Chạy

Cần Node.js. Lần đầu:

```bash
cd ~/Desktop/story-editor
npm install
node server.mjs
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173).

Dừng server bằng `Ctrl + C`.

Render MP4 dùng FFmpeg đi kèm project, không cần cài FFmpeg trên máy. Video đơn không xoay được ghép trực tiếp trong FFmpeg; video xoay hoặc nhiều video dùng cách ghi canvas, mất ít nhất thời lượng clip.

Nếu FFmpeg đi kèm bị hệ điều hành chặn, chạy với `FFMPEG_PATH=/đường/dẫn/ffmpeg node server.mjs`.
# Story-editor
# Story-editor
# Story-editor
