import os
import math
import requests

# ================= КОНФИГУРАЦИЯ =================
BODY = "Mars"
LAYER_ID = "curiosity_hirise_mosaic"  # Мозаика HiRISE (макс. детализация для р-на Curiosity)
ZOOM_LEVELS = range(14, 15)          # 12, 13, 14 — можно расширить, но осторожно с объёмом
EXTENSION = "png"                    # У этого слоя, скорее всего, png (уточняется в Capabilities)

# Ваш прямоугольник
BBOX = {
    "lat_min": -5.07567,
    "lat_max": -4.70007,
    "lon_min": 137.03299,
    "lon_max": 137.49511,
}

OUTPUT_DIR = "mars_hirise_tiles"
# ===============================================

def deg2tile(lat, lon, zoom):
    n_cols = 2 ** (zoom + 1)
    n_rows = 2 ** zoom
    x = int(math.floor((lon + 180.0) / 360.0 * n_cols))
    y = int(math.floor((90.0 - lat) / 180.0 * n_rows))
    x = max(0, min(n_cols - 1, x))
    y = max(0, min(n_rows - 1, y))
    return x, y

def tile_range_for_bbox(bbox, zoom):
    x_min, y_min = deg2tile(bbox["lat_max"], bbox["lon_min"], zoom)
    x_max, y_max = deg2tile(bbox["lat_min"], bbox["lon_max"], zoom)
    return x_min, x_max, y_min, y_max

def download_tiles_for_bbox():
    os.makedirs(OUTPUT_DIR, exist_ok=True)
    total_downloaded = 0

    for z in ZOOM_LEVELS:
        x_min, x_max, y_min, y_max = tile_range_for_bbox(BBOX, z)
        count = (x_max - x_min + 1) * (y_max - y_min + 1)
        print(f"[*] Zoom {z}: колонки {x_min}..{x_max}, строки {y_min}..{y_max} (тайлов: {count})")

        # Небольшая защита от случайного «терабайта»
        if count > 5000:
            print(f"  [!] Слишком много тайлов на zoom {z} ({count}). Пропускаем, чтобы не завалить диск.")
            continue

        for y in range(y_min, y_max + 1):
            for x in range(x_min, x_max + 1):
                url = (f"https://trek.nasa.gov/tiles/{BODY}/EQ/{LAYER_ID}/1.0.0/"
                       f"default/default028mm/{z}/{y}/{x}.{EXTENSION}")
                tile_path = os.path.join(OUTPUT_DIR, f"{z}_{y}_{x}.{EXTENSION}")

                if os.path.exists(tile_path):
                    continue

                try:
                    resp = requests.get(url, timeout=20)
                    if resp.status_code == 200 and len(resp.content) > 0:
                        with open(tile_path, "wb") as f:
                            f.write(resp.content)
                        total_downloaded += 1
                        if total_downloaded % 100 == 0:
                            print(f"  ... скачано {total_downloaded} тайлов")
                    else:
                        # Тайл отсутствует (например, за пределами покрытия)
                        pass
                except Exception as e:
                    print(f"  [!] Ошибка {url}: {e}")

    print(f"\n[✓] Готово. Всего скачано новых тайлов: {total_downloaded}")
    print(f"    Папка: {os.path.abspath(OUTPUT_DIR)}")

if __name__ == "__main__":
    download_tiles_for_bbox()