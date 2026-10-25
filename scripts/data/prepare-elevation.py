"""Convert NOAA ETOPO1 CSV grids into lossless packed 16-bit RGB textures.
R/G store (elevation_metres + 12000), B=0. Never derive depth from imagery colour.
Run with Python + numpy + Pillow from the project root.
"""
from pathlib import Path
import json
import numpy as np
from PIL import Image

out = Path('assets/elevation')
for name in ['etopo-global', 'bali-lombok-etopo']:
    source = out / (name + '.csv')
    a = np.loadtxt(source, delimiter=',', skiprows=2)
    lat, lon = np.unique(a[:, 0]), np.unique(a[:, 1])
    if len(lat)*len(lon) != len(a):
        raise ValueError(f'Incomplete grid: {source}, {len(a)} samples')
    # ERDDAP has latitude south-to-north; textures are stored north-to-south.
    heights = a[:, 2].reshape(len(lat), len(lon))[::-1]
    packed = np.round(heights + 12000).clip(0, 65535).astype(np.uint16)
    rgb = np.zeros((len(lat), len(lon), 3), dtype=np.uint8)
    rgb[:, :, 0] = packed >> 8
    rgb[:, :, 1] = packed & 255
    Image.fromarray(rgb).save(out / (name + '.png'))
    meta = dict(width=len(lon),height=len(lat),west=float(lon[0]),east=float(lon[-1]),south=float(lat[0]),north=float(lat[-1]),offset=12000,units='metres relative to mean sea level',source='NOAA NGDC ETOPO1, ice-surface, grid registered',minElevation=float(heights.min()),maxElevation=float(heights.max()),spacingDegrees=float(lon[1]-lon[0]))
    (out / (name + '.json')).write_text(json.dumps(meta,indent=2)+'\n',encoding='utf-8')
    print(name, rgb.shape, meta['minElevation'], meta['maxElevation'])
