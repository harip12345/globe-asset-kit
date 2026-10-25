"""Build compact, single-channel land masks. Runtime needs only the PNGs.
Sources: Natural Earth 50m land (world), 10m land (Indonesia).
Requires Pillow. Run from repository root after downloading source GeoJSON.
"""
import json
from pathlib import Path
from PIL import Image, ImageDraw

ROOT = Path(__file__).resolve().parents[1]

def build(source, destination, size, bounds):
    west, south, east, north = bounds
    w, h = size
    image = Image.new('L', size, 0)
    draw = ImageDraw.Draw(image)
    document = json.loads((ROOT / 'source' / source).read_text(encoding='utf-8'))
    count = 0
    for feature in document['features']:
        geometry = feature['geometry']
        polygons = geometry['coordinates'] if geometry['type'] == 'MultiPolygon' else [geometry['coordinates']]
        for polygon in polygons:
            outer = polygon[0]
            if max(p[0] for p in outer) < west or min(p[0] for p in outer) > east or max(p[1] for p in outer) < south or min(p[1] for p in outer) > north:
                continue
            for index, ring in enumerate(polygon):
                points = [((p[0]-west)/(east-west)*w, (north-p[1])/(north-south)*h) for p in ring]
                draw.polygon(points, fill=255 if index == 0 else 0)
            count += 1
    image.save(ROOT / 'assets' / destination, optimize=True)
    print(destination, size, 'polygons:', count, 'bytes:', (ROOT / 'assets' / destination).stat().st_size)

build('land-50m.geojson', 'world-land.png', (2048,1024), (-180,-90,180,90))
build('land-10m.geojson', 'indonesia-land.png', (4096,2048), (92,-13,143,9))
