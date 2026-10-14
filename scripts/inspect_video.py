import os
import sys

def main():
    print("Testing python video inspection...")
    try:
        import cv2
        cap = cv2.VideoCapture("gemini_generated_video_b7af3c29.mp4")
        width = int(cap.get(cv2.CAP_PROP_FRAME_WIDTH))
        height = int(cap.get(cv2.CAP_PROP_FRAME_HEIGHT))
        fps = cap.get(cv2.CAP_PROP_FPS)
        frame_count = int(cap.get(cv2.CAP_PROP_FRAME_COUNT))
        duration = frame_count / fps if fps > 0 else 0
        print(f"Video Info: {width}x{height}, {fps:.2f} fps, {duration:.2f}s, {frame_count} frames")
        
        ret, frame = cap.read()
        if ret:
            # Check edge colors (top-left, top-right, corners)
            top_left = frame[0, 0].tolist() # BGR
            top_right = frame[0, -1].tolist()
            bottom_left = frame[-1, 0].tolist()
            bottom_right = frame[-1, -1].tolist()
            print(f"Corner BGR: TL={top_left}, TR={top_right}, BL={bottom_left}, BR={bottom_right}")
            cv2.imwrite("frontend/public/video_poster.jpg", frame)
            print("Wrote frontend/public/video_poster.jpg")
        cap.release()
    except Exception as e:
        print("Error with cv2:", e)

if __name__ == "__main__":
    main()
