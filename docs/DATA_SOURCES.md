# Data sources

Prepared inputs were collected on October 25, 2026. Every event retains source URLs, retrieval times, model type, units and limitations. The prepared manifest checks eight local source/assessment files. A missing value is not converted to zero.

| Source | Integrated use | Important limit |
|---|---|---|
| [INEC 2022](https://idgn.ecuadorencifras.gob.ec/server/rest/services/Hosted/Marco_Geoestadistico_2022/FeatureServer/7) | 6652 Guayaquil census polygons; 246 separate Samborondón context polygons | Main-parish code is not a legal urban boundary |
| [Municipal nomenclature](https://sil.guayaquil.gob.ec/territorial/sectores-de-nomenclatura/) | 95 source areas, official quadrant labels and recognizable names | Whole-polygon majority grouping creates 100 analytical groups with parish fallbacks, not new legal boundaries |
| [ECMWF via Open-Meteo](https://open-meteo.com/en/docs/single-runs-api) | Historical forecast runs, hourly modeled rainfall and a preserved prospective capture | Model output, about 9 km; not measurements at street level. Exact publication time unavailable |
| [ESPOL FIMCM](https://www.fimcm.espol.edu.ec/es/noticias/analisis-meteorologico-y-oceanografico-el-impacto-de-las-inusuales-precipitaciones-de) | Five published October 19 totals from 112 to 181 mm | Exact station coordinates and accumulation windows unavailable; no fabricated interpolation |
| [Ecuavisa attributed to Segura EP](https://www.ecuavisa.com/amp/guayaquil/68-sectores-afectados-lluvias-guayaquil-tormenta-electrica-20261025-0011.html) | 78 typed records, including 68 urban water-accumulation locations | Eleven candidate coordinates, seven provisional sector assignments; four sector-ambiguous and 67 without coordinates. Collection incomplete |
| [Susceptibility footprints](https://services7.arcgis.com/NWWHhu45fOJtCgG3/arcgis/rest/services/Zonas_Inundables_GYE/FeatureServer/0) | 5746 unioned/intersected geometries | Effective date and detailed reuse terms not supplied; not storm-specific flooded surfaces |
| [Municipal infrastructure](https://geoportalcat.guayaquil.gob.ec/arcgis/rest/services/Geoportal_Actualizado/GEOPORTAL_ACTUALIZADO/MapServer) | Catalogue only; layers 8, 46, 48 and 55 | HTTP 500; no usable drainage condition/capacity, runoff or river geometry downloaded |

INAMHI’s portal and NASA IMERG documentation were researched, but no compatible structured instrumental feed or satellite file was integrated. IMERG is a satellite precipitation estimate, not a rain gauge. Detailed terrain and tidal data remain unavailable in the analysis. The app does not silently substitute an unrelated dataset.

Additional primary references reviewed for future work: [INOCAR tide tables](https://inocar.mil.ec/web/index.php/tabla-de-mareas) and [Copernicus DEM](https://dataspace.copernicus.eu/explore-data/data-collections/copernicus-contributing-missions/collections-description/COP-DEM). No tide series or elevation raster from these references has been downloaded and aligned with the storm windows; they do not enter current scores.

Prepared mode uses local boundaries, labels and weather snapshots without external calls. Optional street basemap mode uses OpenFreeMap/OpenStreetMap and needs internet. No weather service is queried by merely opening the demonstration. `npm run data:update` is a separate explicit capture process; raw captures and prior prepared versions remain on disk. Public accessibility does not imply every dataset has unrestricted redistribution terms; retain attribution and check source-specific terms before publishing complete datasets.
