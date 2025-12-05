// api/bus-locations.js
import { parseStringPromise } from 'xml2js';

const TAGO_BASE_URL =
  'https://apis.data.go.kr/1613000/BusLcInfoInqireService/getRouteAcctoBusLcList';

export default async function handler(req, res) {
  const { cityCode, routeId } = req.query;

  if (!cityCode || !routeId) {
    return res.status(400).json({ error: 'cityCode, routeId 필요함' });
  }

  const serviceKey = process.env.TAGO_SERVICE_KEY; // Vercel 환경변수
  if (!serviceKey) {
    return res.status(500).json({ error: 'TAGO_SERVICE_KEY 미설정' });
  }

  const url =
    `${TAGO_BASE_URL}?` +
    `serviceKey=${serviceKey}` +
    `&pageNo=1&numOfRows=100&_type=xml` +
    `&cityCode=${encodeURIComponent(cityCode)}` +
    `&routeId=${encodeURIComponent(routeId)}`;

  try {
    const tagoRes = await fetch(url);
    if (!tagoRes.ok) {
      return res.status(500).json({ error: 'TAGO API 오류', status: tagoRes.status });
    }

    const xml = await tagoRes.text();
    const json = await parseStringPromise(xml, { explicitArray: false });

    // 네가 server.js에서 쓰던 파싱 로직 그대로 가져오기
    const items = json?.response?.body?.items?.item;
    if (!items) {
      return res.json([]);
    }

    const arr = Array.isArray(items) ? items : [items];

    // TAGO 응답 → 프론트에 맞는 형식으로 변환
    const result = arr.map((it) => ({
      lat: Number(it.gpslong),  // 위도/경도 매핑 주의! (우리가 이미 고쳐놨던 그 방식)
      lng: Number(it.gpslati),
      routenm: it.routenm,
      vehicleno: it.vehicleno,
      nodenm: it.nodenm
    }));

    return res.status(200).json(result);
  } catch (err) {
    console.error(err);
    return res.status(500).json({ error: '서버 오류', detail: err.message });
  }
}