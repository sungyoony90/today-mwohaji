import { readFileSync, writeFileSync } from "node:fs";
import { resolve } from "node:path";

const sourcePath = process.argv[2];
if (!sourcePath) throw new Error("원본 spots.json 경로를 인자로 전달해 주세요.");

const source = JSON.parse(readFileSync(resolve(sourcePath), "utf8"));
const regionPrefixes = ["서울", "경기", "인천", "강원", "충북", "충남", "세종", "대전", "전북", "전남", "광주", "경북", "경남", "대구", "울산", "부산", "제주"];
const canonicalRegion = (region) => region === "경기도" ? "경기" : region;
const regionFromAddress = (address) => regionPrefixes.find((region) => [" ", "특별시", "광역시", "도", "특별자치시", "특별자치도"].some((suffix) => address?.startsWith(`${region}${suffix}`))) || "";

const catalog = source.filter((spot) => spot.id && spot.title).map((spot) => {
  const sourceRegion = canonicalRegion(spot.region || "서울");
  const addressRegion = regionFromAddress(spot.address);
  return {
    id: spot.id,
    title: spot.title,
    emoji: spot.emoji || "📍",
    region: addressRegion || sourceRegion,
    area: spot.area || "",
    desc: spot.desc || "",
    address: spot.address || "",
    lat: spot.lat ?? null,
    lng: spot.lng ?? null,
    kakaoUrl: spot.kakaoUrl || "",
    searchQuery: spot.searchQuery || spot.title,
    company: spot.company || "both",
    moods: spot.moods || [],
    time: spot.time || "",
    sourceRegion,
    regionCorrected: Boolean(addressRegion && addressRegion !== sourceRegion),
  };
});

const outputPath = new URL("../spot-catalog.js", import.meta.url);
writeFileSync(outputPath, `// Generated from the existing app's spots.json. Historical place data; current availability is unverified.\nwindow.SPOT_CATALOG = ${JSON.stringify(catalog)};\n`);
process.stdout.write(`${catalog.length} places, ${catalog.filter((spot) => spot.regionCorrected).length} address/region mismatches normalized.\n`);
