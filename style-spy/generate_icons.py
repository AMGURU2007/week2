import os
import math
from PIL import Image, ImageDraw

def create_icon(size):
    # Supersample at 4x for smooth antialiasing
    scale = 4
    canvas_size = size * scale
    img = Image.new("RGBA", (canvas_size, canvas_size), (0, 0, 0, 0))
    draw = ImageDraw.Draw(img)

    margin = 6 * scale
    radius = (canvas_size - 2 * margin) / 2
    cx, cy = canvas_size / 2, canvas_size / 2

    # Draw rounded dark background container (rounded rect / squircle)
    corner = 20 * scale if size >= 48 else 4 * scale
    bg_box = [margin, margin, canvas_size - margin, canvas_size - margin]
    draw.rounded_rectangle(bg_box, radius=corner, fill=(15, 23, 42, 255)) # Dark slate (#0F172A)

    # Subtle inner border
    draw.rounded_rectangle(bg_box, radius=corner, outline=(51, 65, 85, 255), width=int(1.5 * scale))

    # Color palette ring segments (cyan, purple, pink, amber)
    ring_radius = radius * 0.76
    ring_inner = radius * 0.52
    ring_box = [cx - ring_radius, cy - ring_radius, cx + ring_radius, cy + ring_radius]
    
    colors = [
        (6, 182, 212, 255),   # Cyan #06B6D4
        (139, 92, 246, 255),  # Violet #8B5CF6
        (236, 72, 153, 255),  # Pink #EC4899
        (245, 158, 11, 255)   # Amber #F59E0B
    ]
    
    for i, color in enumerate(colors):
        start_angle = i * 90 + 10
        end_angle = (i + 1) * 90 - 10
        draw.arc(ring_box, start=start_angle, end=end_angle, fill=color, width=int(ring_radius - ring_inner))

    # Central Inspector Glass / Spy lens
    lens_radius = ring_inner * 0.8
    lens_box = [cx - lens_radius, cy - lens_radius, cx + lens_radius, cy + lens_radius]
    draw.ellipse(lens_box, fill=(30, 41, 59, 255), outline=(248, 250, 252, 255), width=max(1, int(2 * scale)))

    # Central pupil / eyedropper pip
    center_pip_r = lens_radius * 0.38
    draw.ellipse([cx - center_pip_r, cy - center_pip_r, cx + center_pip_r, cy + center_pip_r], fill=(56, 189, 248, 255))

    # Glass highlight reflection arc
    highlight_box = [cx - lens_radius * 0.7, cy - lens_radius * 0.7, cx + lens_radius * 0.7, cy + lens_radius * 0.7]
    draw.arc(highlight_box, start=200, end=270, fill=(255, 255, 255, 200), width=max(1, int(1.5 * scale)))

    # Spyglass handle extending to bottom-right corner
    handle_len = radius * 0.4
    h_start_x = cx + lens_radius * 0.7
    h_start_y = cy + lens_radius * 0.7
    h_end_x = h_start_x + handle_len * 0.8
    h_end_y = h_start_y + handle_len * 0.8
    draw.line([h_start_x, h_start_y, h_end_x, h_end_y], fill=(203, 213, 225, 255), width=max(1, int(3 * scale)))

    # Resize down with Lanczos resampling
    img = img.resize((size, size), Image.Resampling.LANCZOS)
    return img

out_dir = r"C:\Users\Lenovo\.gemini\antigravity\scratch\style-spy\icons"
for s in [16, 48, 128]:
    im = create_icon(s)
    path = os.path.join(out_dir, f"icon{s}.png")
    im.save(path, "PNG")
    print(f"Generated {path} ({s}x{s})")
