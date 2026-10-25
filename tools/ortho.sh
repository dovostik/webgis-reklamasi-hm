#!/usr/bin/env bash
# Ubah GeoTIFF orthophoto menjadi ubin XYZ WebP (EPSG:3857) dengan batas ukuran agar muat di GitHub Pages.
set -euo pipefail
trap 'echo "::error::ortho.sh gagal di baris $LINENO: $BASH_COMMAND"' ERR
W="$1"; TAG="$2"; cd "$W"
SRC=$(find . -maxdepth 1 -type f \( -iname "*.tif" -o -iname "*.tiff" \) | head -1)
[ -n "$SRC" ] || { echo "::error::Tidak ada file GeoTIFF"; exit 1; }
echo "Sumber: $SRC"; gdalinfo "$SRC" | head -30 || true
gdalwarp -q -t_srs EPSG:3857 -r bilinear -dstalpha -multi -wo NUM_THREADS=ALL_CPUS -co TILED=YES -co COMPRESS=DEFLATE -co BIGTIFF=IF_SAFER "$SRC" m.tif
read RES W84 S84 E84 N84 <<<"$(python3 - <<'P'
from osgeo import gdal, osr
d = gdal.Open('m.tif'); g = d.GetGeoTransform(); w, h = d.RasterXSize, d.RasterYSize
x0, y1 = g[0], g[3]; x1, y0 = x0 + g[1] * w, y1 + g[5] * h
s = osr.SpatialReference(); s.ImportFromEPSG(3857); t = osr.SpatialReference(); t.ImportFromEPSG(4326); t.SetAxisMappingStrategy(osr.OAMS_TRADITIONAL_GIS_ORDER)
c = osr.CoordinateTransformation(s, t); a = c.TransformPoint(x0, y0); b = c.TransformPoint(x1, y1)
print(abs(g[1]), a[0], a[1], b[0], b[1])
P
)"
# zoom asli dari ukuran piksel; dibatasi agar total ubin ±< 900 MB (asumsi 25 KB/ubin)
MZ=$(python3 - "$RES" "$W84" "$S84" "$E84" "$N84" <<'P'
import sys, math
res, w, s, e, n = map(float, sys.argv[1:])
nat = min(21, max(16, math.ceil(math.log2(156543.034 / res))))
def tiles(z):
    k = 2 ** z
    def tx(lon): return int((lon + 180) / 360 * k)
    def ty(lat): r = math.radians(lat); return int((1 - math.asinh(math.tan(r)) / math.pi) / 2 * k)
    return (tx(e) - tx(w) + 1) * (ty(s) - ty(n) + 1)
z = nat
while z > 16 and sum(tiles(i) for i in range(14, z + 1)) * 25 > 900_000: z -= 1
print(z)
P
)
echo "Ukuran piksel ${RES} m, zoom maksimum ${MZ}"
gdal2tiles.py --xyz -z "14-${MZ}" -r average --processes="$(nproc)" --tiledriver=WEBP --webp-quality=75 -w none m.tif t >/dev/null
ID=$(echo "$TAG" | tr -cd 'A-Za-z0-9-_')
mkdir -p "out/$ID" && mv t/* "out/$ID/"
cat > out/meta.json <<J
{"id":"$ID","tag":"$TAG","dibuat":"$(date -u +%Y-%m-%dT%H:%M:%SZ)","minzoom":14,"maxzoom":$MZ,"bounds":[$W84,$S84,$E84,$N84],"res_m":$RES,"ext":"webp"}
J
cat out/meta.json; echo "::notice::Ortho $TAG: zoom 14-$MZ, $(find out -name '*.webp' | wc -l) ubin, $(du -sh out | cut -f1)"
(cd out && zip -q -r -0 ../ortho.zip .)
ls -la ortho.zip
