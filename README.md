# Story Editor

Prototype editor story 9:16.

- Upload ảnh, bố cục Tự do hoặc Chia đôi (tối đa 2 ảnh trên/dưới, mỗi ảnh lấp đầy nửa khung và bị cắt theo nửa đó)
- Upload video và xem trước trên canvas
- Thêm chữ với 5 phông (Roboto, Montserrat, Playfair Display, Pacifico, Oswald, đều có tiếng Việt), sticker ❤️ 😊 😢, kéo, resize, xoay, xóa layer
- Upload nhạc nền, chọn đoạn bắt đầu/kết thúc và nghe thử
- Không có video và không có nhạc: Export PNG 1080×1920
- Có video hoặc có nhạc: Export MP4 ghép chữ, sticker và ảnh lên clip, tải `story.mp4`
- Tiếng gốc của video không được giữ: MP4 chỉ có nhạc đã chọn (không chọn nhạc thì không có tiếng)
- Có video: MP4 dài bằng video, nhạc bị cắt ở cuối video, nhạc ngắn hơn thì phần còn lại im lặng. Chỉ có ảnh và nhạc: MP4 dài đúng bằng đoạn nhạc đã chọn

## Chạy

Cần Node.js. Lần đầu:

```bash
cd ~/Desktop/story-editor
npm install
node server.mjs
```

Mở [http://127.0.0.1:4173](http://127.0.0.1:4173).

Phải mở trang qua server này; mở thẳng `index.html` từ ổ đĩa không chạy được vì code nằm trong các module `src/*.js`. Phông chữ tải từ Google Fonts nên cần mạng khi chỉnh sửa, mất mạng thì chữ dùng phông hệ thống.

Dừng server bằng `Ctrl + C`.

Render MP4 dùng FFmpeg đi kèm project, không cần cài FFmpeg trên máy. Video đơn không xoay được ghép trực tiếp trong FFmpeg; video xoay hoặc nhiều video dùng cách ghi canvas, mất ít nhất thời lượng clip.

Nếu FFmpeg đi kèm bị hệ điều hành chặn, chạy với `FFMPEG_PATH=/đường/dẫn/ffmpeg node server.mjs`.
# Story-editor
# Story-editor
# Story-editor
