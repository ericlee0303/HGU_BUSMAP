// server.js
const express = require('express');
const axios = require('axios');
const cors = require('cors');
require('dotenv').config();

const app = express();
app.use(cors());

const TAGO_BASE_URL = 'http://apis.data.go.kr/1613000/BusLcInfoInqireService';
const SERVICE_KEY = process.env.TAGO_SERVICE_KEY;

function toArray(maybeArray) {
  if (!maybeArray) return [];
  return Array.isArray(maybeArray) ? maybeArray : [maybeArray];
}

// 노선별 버스 위치
// GET /api/bus-locations?cityCode=37010&routeId=PHB350000389
app.get('/api/bus-locations', async (req, res) => {
  const { cityCode, routeId } = req.query;

  if (!cityCode || !routeId) {
    return res
      .status(400)
      .json({ error: 'cityCode, routeId 쿼리 파라미터가 필요합니다.' });
  }

  if (!SERVICE_KEY) {
    return res
      .status(500)
      .json({ error: '서버에 TAGO 서비스키가 설정되어 있지 않습니다.' });
  }

  try {
    const url = `${TAGO_BASE_URL}/getRouteAcctoBusLcList`;

    const response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        _type: 'json',
        cityCode,
        routeId,
        numOfRows: 100,
        pageNo: 1
      }
    });

    const body = response.data.response.body;
    const items = toArray(body?.items?.item);

    const result = items.map(item => {
      // TAGO에서 내려오는 원시 값
      const raw1 = Number(item.gpslati);  // 실제로는 경도
      const raw2 = Number(item.gpslong);  // 실제로는 위도

      // 🔥 값의 범위를 보고 자동으로 lat/lng 결정
      let lat, lng;
      if (raw1 > 90 && raw2 < 90) {
        // raw1이 129.xxx, raw2가 36.xxx → raw2 = 위도, raw1 = 경도
        lat = raw2;
        lng = raw1;
      } else if (raw2 > 90 && raw1 < 90) {
        // 반대 케이스 대비
        lat = raw1;
        lng = raw2;
      } else {
        // 둘 다 0~90 사이면 그냥 첫 번째를 위도라고 가정
        lat = raw1;
        lng = raw2;
      }

      console.log(
        '서버 매핑 결과:',
        item.nodenm,
        'raw1=', raw1,
        'raw2=', raw2,
        '=> lat=', lat,
        'lng=', lng
      );

      return {
        routenm: item.routenm,
        routetp: item.routetp,
        nodenm: item.nodenm,
        nodeid: item.nodeid,
        nodeord: item.nodeord,
        vehicleno: item.vehicleno,
        lat, // 최종 위도(35~36)
        lng  // 최종 경도(129.xxx)
      };
    });

    res.set('Cache-Control', 'no-store');
    res.json(result);
  } catch (err) {
    console.error('[ERROR] /api/bus-locations', err);
    res.status(500).json({ error: 'TAGO 버스 위치 조회 중 오류가 발생했습니다.' });
  }
});

// 도시 코드 (필요하면 사용)
app.get('/api/cities', async (req, res) => {
  if (!SERVICE_KEY) {
    return res
      .status(500)
      .json({ error: '서버에 TAGO 서비스키가 설정되어 있지 않습니다.' });
  }

  try {
    const url = `${TAGO_BASE_URL}/getCtyCodeList`;
    const response = await axios.get(url, {
      params: {
        serviceKey: SERVICE_KEY,
        _type: 'json'
      }
    });

    const body = response.data.response.body;
    const items = toArray(body?.items?.item);

    res.json(
      items.map(i => ({
        citycode: i.citycode,
        cityname: i.cityname
      }))
    );
  } catch (err) {
    console.error('[ERROR] /api/cities', err);
    res.status(500).json({ error: '도시 코드 조회 중 오류' });
  }
});

const PORT = process.env.PORT || 4000;
app.listen(PORT, () => {
  console.log(`✅ Bus proxy server running on http://localhost:${PORT}`);
});