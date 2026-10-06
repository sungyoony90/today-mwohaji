/* Research-backed activity candidates. Existing IDs remain stable for saved places. */
(function (root) {
  const interestActivity = Object.freeze({ walk: 'walk', running: 'run', exhibition: 'exhibit', books: 'read', cafe: 'cafe', activity: 'play' });
  const validCoords = (point) => point && Number.isFinite(point.lat) && Number.isFinite(point.lng) && Math.abs(point.lat) <= 90 && Math.abs(point.lng) <= 180;
  const nameKey = (name) => String(name || '').normalize('NFKC').replace(/\s+/g, '').toLowerCase();
  const verifiedAliases = Object.freeze({
    'research-walk-cheongcho-lake': ['청초호수공원'],
    'research-run-seokchon-lake': ['석촌호수 밤산책'],
  });
  const allowedActivities = new Set(Object.values(interestActivity));
  const allowedReviews = new Set(['verified', 'conditional', 'hold', 'out-of-scope']);
  function applyAudit(spots, reviews) {
    const byId = new Map();
    const duplicates = new Set();
    for (const review of reviews) {
      if (byId.has(review.id)) duplicates.add(review.id);
      byId.set(review.id, review);
    }
    return spots.map((spot) => {
      const review = byId.get(spot.id);
      // Unreviewed future additions are not silently promoted by text matching.
      if (!review) return { ...spot, activities: [], classificationStatus: 'hold', classificationNote: '행동 분류와 이용 조건 확인 전이에요.' };
      const valid = !duplicates.has(spot.id) && allowedReviews.has(review.reviewStatus)
        && Array.isArray(review.activities) && review.activities.every((activity) => allowedActivities.has(activity))
        && Boolean(review.reason && review.admissionNote)
        && (review.reviewStatus !== 'verified' || /^https:\/\//.test(review.sourceUrl || ''));
      const result = { ...spot,
        activities: valid ? [...new Set(review.activities)] : [],
        classificationStatus: valid ? review.reviewStatus : 'hold',
        classificationNote: valid ? review.reason : '분류 검수 자료를 다시 확인해야 해요.',
        classificationSourceUrl: valid ? review.sourceUrl || '' : '',
        classificationCheckedAt: review.sourceCheckedAt || '',
        duplicateOf: valid && spots.some((item) => item.id === review.duplicateOf) ? review.duplicateOf : '',
        admissionNote: valid ? review.admissionNote : spot.admissionNote,
      };
      for (const key of ['availableFrom', 'availableUntil', 'closedDates', 'closedWeekdays', 'openDates', 'openWeekdays']) {
        if (valid && review[key] !== undefined) result[key] = review[key];
      }
      if (review.locationIssue) {
        result.lat = null;
        result.lng = null;
        result.kakaoUrl = '';
        result.searchQuery = review.searchQuery || `${spot.region} ${spot.venueTitle || spot.title}`;
        result.locationIssue = review.locationIssue;
      }
      return result;
    });
  }
  const isRecommendable = (spot) => !['hold', 'out-of-scope'].includes(spot.classificationStatus);
  function isActive(spot, date) {
    const weekday = new Date(`${date}T12:00:00+09:00`).getUTCDay();
    const exception = spot.openDates?.includes(date);
    return spot.auditStatus !== 'hold' && !spot.closedDates?.includes(date) && (!spot.availableFrom || date >= spot.availableFrom) && (!spot.availableUntil || date <= spot.availableUntil)
      && (exception || (!spot.closedWeekdays?.includes(weekday) && (!spot.openWeekdays || spot.openWeekdays.includes(weekday))));
  }
  function build(base, research, date) {
    const result = new Map();
    for (const row of research) {
      if (!isActive(row, date)) continue;
      const names = [row.venueTitle || row.title, ...(row.catalogTitleAliases || []), ...(verifiedAliases[row.id] || [])].map(nameKey);
      const matches = base.filter((spot) => spot.region === row.region && names.includes(nameKey(spot.title)));
      // Ambiguous names never inherit coordinates from an arbitrary venue.
      const venue = matches.length === 1 ? matches[0] : null;
      const exhibition = row.activities.includes('exhibit') && Boolean(row.venueTitle);
      const id = venue && !exhibition ? venue.id : row.id;
      const previous = result.get(id);
      result.set(id, {
        ...(venue || {}), ...row, id,
        title: row.title,
        lat: validCoords(row) ? row.lat : validCoords(venue) ? venue.lat : null,
        lng: validCoords(row) ? row.lng : validCoords(venue) ? venue.lng : null,
        address: row.address || venue?.address || '',
        searchQuery: row.searchQuery || row.venueTitle || `${row.region} ${row.title}`,
        activities: [...new Set([...(previous?.activities || []), ...row.activities])],
        activityResearch: true,
      });
    }
    return [...result.values()];
  }
  function distance(point, origin) {
    if (!validCoords(point) || !validCoords(origin)) return null;
    const rad = (n) => n * Math.PI / 180;
    const a = Math.sin(rad(point.lat - origin.lat) / 2) ** 2 + Math.cos(rad(origin.lat)) * Math.cos(rad(point.lat)) * Math.sin(rad(point.lng - origin.lng) / 2) ** 2;
    return 6371 * 2 * Math.atan2(Math.sqrt(Math.min(1, a)), Math.sqrt(Math.max(0, 1 - a)));
  }
  function select(spots, { activity, region, origin, scope = 'nearby', radiusKm = 30 }) {
    const tagged = [...new Map(spots.filter((spot) => isRecommendable(spot) && spot.activities?.includes(activity))
      .map((spot) => [spot.duplicateOf || spot.id, spot])).values()];
    const measured = tagged.map((spot) => ({ ...spot, distanceKm: distance(spot, origin) }));
    const regional = measured.filter((spot) => spot.region === region);
    const nearby = validCoords(origin) && scope !== 'region'
      ? measured.filter((spot) => spot.distanceKm !== null && spot.distanceKm <= radiusKm) : [];
    const mode = nearby.length ? 'nearby' : 'region';
    const items = mode === 'nearby'
      ? [...nearby, ...regional.filter((spot) => spot.distanceKm === null)] : regional;
    items.sort((a, b) => (a.distanceKm ?? Infinity) - (b.distanceKm ?? Infinity) || a.title.localeCompare(b.title, 'ko'));
    return { items, mode, nearbyCount: nearby.length, unlocatedCount: items.filter((spot) => spot.distanceKm === null).length };
  }
  root.ActivityCatalog = Object.freeze({ build, applyAudit, select, distance, isActive, isRecommendable, interestActivity });
})(typeof window === 'undefined' ? globalThis : window);
