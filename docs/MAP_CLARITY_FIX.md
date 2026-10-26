# Map clarity and return navigation

The original interface showed purple verification markers without their meaning in the attention legend. They now have a visible explanation: **Needs a check — no flood confirmed**. Clicking a verification marker opens an explanation before the optional **Explore this area** action. Red markers mean **Reported problem — approximate location**; their evidence remains distinct from estimated attention.

The map now contains a persistent **Back to Guayaquil** button. It clears selected area, subarea, search and zone filters and resets the camera even if the area selection was already empty. The selected storm and map layer remain unchanged. Any open marker popup closes on return.

The mostly gray display was caused by applying a complete-area aggregation rule to the overview: one missing subarea made an entire named group unknown. That strict aggregate remains unknown, but the map now shows the actual smaller-area values without small-area borders at city scale. Missing parts remain gray. No measurements, thresholds or assessment scores were changed.

For the prepared October 24–25 main-parish assessment, 4,220 smaller areas have lower attention, 1,096 preventive watch, 191 priority monitoring and 909 insufficient information. These are analytical categories, not counts of flooded places. Census borders appear only at closer zoom; labels are spaced again after each camera movement.

Verification: 45 automated tests passed, including three regression checks for category thresholds, missing/zero distinction, visibility by zoom and actual prepared-data counts. Production build passed with the existing MapLibre bundle-size advisory. The in-app browser was used to select Letamendi and return using the map button; coverage returned from 217 polygons to 6,416 without changing the storm. A purple marker was then clicked: its explanation appeared without changing the selection. **Explore this area** opened Estero Salado (117 polygons), and the map return button restored 6,416 sectors. Screenshot: `docs/screenshots/map-clarity-fixed.jpg`. This check does not establish compatibility with every external translation tool.
