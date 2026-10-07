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

Render MP4 dùng FFmpeg đi kèm project, không cần cài FFmpeg trên máy. Thời gian render xấp xỉ thời lượng clip.
# Story-editor
# Story-editor
