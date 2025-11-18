import axios from 'axios';

// 환경 변수에서 API 키를 가져옵니다.
const API_KEY = "a643e17e0e83fbc6f0caef23fc23908d260f1dc6b4da92fe7446d727224e7ade";

// 위도, 경도를 기상청 격자 X, Y 좌표로 변환하는 함수
const dfs_xy_conv = (code, v1, v2) => {
    const RE = 6371.00877; // 지구 반경(km)
    const GRID = 5.0; // 격자 간격(km)
    const SLAT1 = 30.0; // 투영 위도1(degree)
    const SLAT2 = 60.0; // 투영 위도2(degree)
    const OLON = 126.0; // 기준점 경도(degree)
    const OLAT = 38.0; // 기준점 위도(degree)
    const XO = 43; // 기준점 X좌표(GRID)
    const YO = 136; // 기1준점 Y좌표(GRID)

    const DEGRAD = Math.PI / 180.0;

    const re = RE / GRID;
    const slat1 = SLAT1 * DEGRAD;
    const slat2 = SLAT2 * DEGRAD;
    const olon = OLON * DEGRAD;
    const olat = OLAT * DEGRAD;

    let sn = Math.tan(Math.PI * 0.25 + slat2 * 0.5) / Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sn = Math.log(Math.cos(slat1) / Math.cos(slat2)) / Math.log(sn);
    let sf = Math.tan(Math.PI * 0.25 + slat1 * 0.5);
    sf = Math.pow(sf, sn) * Math.cos(slat1) / sn;
    let ro = Math.tan(Math.PI * 0.25 + olat * 0.5);
    ro = re * sf / Math.pow(ro, sn);
    const rs = {};

    if (code === "toXY") {
        rs['lat'] = v1;
        rs['lng'] = v2;
        let ra = Math.tan(Math.PI * 0.25 + (v1) * DEGRAD * 0.5);
        ra = re * sf / Math.pow(ra, sn);
        let theta = v2 * DEGRAD - olon;
        if (theta > Math.PI) theta -= 2 * Math.PI;
        if (theta < -Math.PI) theta += 2 * Math.PI;
        theta *= sn;
        rs['x'] = Math.floor(ra * Math.sin(theta) + XO + 0.5);
        rs['y'] = Math.floor(ro - ra * Math.cos(theta) + YO + 0.5);
    }
    return rs;
}

// 현재 시간 기준 가장 최신 예보 날짜/시간 계산 로직
const getBaseDateTime = () => {
    const now = new Date();
    let baseDate = new Date();
    let baseTime = '';

    const availableHours = [2, 5, 8, 11, 14, 17, 20, 23];
    const currentHour = now.getHours();
    const currentMinutes = now.getMinutes();

    if (currentHour < 2 || (currentHour === 2 && currentMinutes < 15)) {
        baseDate.setDate(baseDate.getDate() - 1);
        baseTime = '2300';
    } else {
        const targetHour = availableHours.slice().reverse().find(h => h <= currentHour);
        baseTime = `${String(targetHour).padStart(2, '0')}00`;
    }

    const year = baseDate.getFullYear();
    const month = String(baseDate.getMonth() + 1).padStart(2, '0');
    const day = String(baseDate.getDate()).padStart(2, '0');
    
    return {
        base_date: `${year}${month}${day}`,
        base_time: baseTime
    };
};

// 단기 예보 조회 함수 (오늘/미래)
const getShortTermForecast = async (lat, lon) => {
    const { base_date, base_time } = getBaseDateTime();
    const grid = dfs_xy_conv("toXY", lat, lon);
    const url = 'http://apis.data.go.kr/1360000/VilageFcstInfoService_2.0/getVilageFcst';
    
    try {
        const response = await axios.get(url, {
            params: {
                ServiceKey: decodeURIComponent(API_KEY), // 서비스 키 디코딩
                pageNo: '1',
                numOfRows: '1000',
                dataType: 'JSON',
                base_date: base_date,
                base_time: base_time,
                nx: grid.x,
                ny: grid.y
            }
        });

        const header = response.data.response?.header;
        if (header && header.resultCode === '00') {
            return response.data.response.body.items.item;
        } else {
            console.error("Short-term Forecast API Error:", header ? header.resultMsg : "No response header", `(Code: ${header?.resultCode})`);
            return null;
        }
    } catch (error) {
        console.error("Axios request failed (Short-term):", error.message);
        return null;
    }
};

// 과거 날씨 조회 함수 (ASOS)
const getPastWeather = async (date) => {
    const url = 'http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList';
    try {
        const response = await axios.get(url, {
            params: {
                ServiceKey: decodeURIComponent(API_KEY), // 서비스 키 디코딩
                pageNo: '1',
                numOfRows: '10',
                dataType: 'JSON',
                dataCd: 'ASOS',
                dateCd: 'DAY',
                startDt: date,
                endDt: date,
                stnIds: '108' // 서울 기준
            }
        });

        const header = response.data.response?.header;
        if (header && header.resultCode === '00') {
            const item = response.data.response.body.items.item[0];
            if (!item) return null;

            const temp = parseFloat(item.avgTa);
            const dailyRain = parseFloat(item.sumRn);
            const cloud = parseFloat(item.avgTca);
            const pty = dailyRain > 0 ? 1 : 0;
            let sky;
            if (cloud <= 2) sky = 1;
            else if (cloud <= 8) sky = 3;
            else sky = 4;

            return { temp, sky, pty };
        } else {
            console.error("ASOS API Error:", header ? header.resultMsg : "No response header", `(Code: ${header?.resultCode})`);
            return null;
        }
    } catch (error) {
        console.error("Axios request failed (ASOS):", error.message);
        return null;
    }
};

// 월별 과거 날씨 조회 및 요약 함수 (ASOS)
export const getMonthlyWeather = async (year, month) => {
    const startDt = `${year}${String(month).padStart(2, '0')}01`;
    const endDt = new Date(year, month, 0).getDate(); // 해당 월의 마지막 날
    const endDtStr = `${year}${String(month).padStart(2, '0')}${endDt}`;

    const url = 'http://apis.data.go.kr/1360000/AsosDalyInfoService/getWthrDataList';
    try {
        const response = await axios.get(url, {
            params: {
                ServiceKey: decodeURIComponent(API_KEY),
                pageNo: '1',
                numOfRows: '31', // 한 달 데이터 충분히
                dataType: 'JSON',
                dataCd: 'ASOS',
                dateCd: 'DAY',
                startDt: startDt,
                endDt: endDtStr,
                stnIds: '108' // 서울 기준
            }
        });

        const header = response.data.response?.header;
        if (header && header.resultCode === '00') {
            const items = response.data.response.body.items.item;
            if (!items || items.length === 0) return "(시스템 정보: 해당 월의 날씨 데이터가 없습니다.)";

            // 강수량 있는 날짜 필터링 및 정렬
            const rainyDays = items
                .filter(item => item.sumRn && parseFloat(item.sumRn) > 0)
                .map(item => ({
                    date: item.tm,
                    rain: parseFloat(item.sumRn)
                }))
                .sort((a, b) => b.rain - a.rain);

            // 흐린 날 계산
            const cloudyDaysCount = items.filter(item => item.avgTca && parseFloat(item.avgTca) >= 8).length;

            let summary = `(시스템 정보: ${year}년 ${month}월 날씨 요약 -> `;

            if (rainyDays.length > 0) {
                const topRainyDays = rainyDays.slice(0, 5); // 최대 5개
                summary += `비가 가장 많이 온 날은 ${topRainyDays.map(d => `${new Date(d.date).getDate()}일(${d.rain}mm)`).join(', ')}입니다. `;
            } else {
                summary += "비가 온 날은 없었습니다. ";
            }

            if (cloudyDaysCount > 0) {
                summary += `전체적으로 ${cloudyDaysCount}일 이상 흐렸습니다.`;
            }

            summary += ")";
            return summary;

        } else {
            console.error("ASOS Monthly API Error:", header ? header.resultMsg : "No response header", `(Code: ${header?.resultCode})`);
            return `(시스템 정보: ${year}년 ${month}월 날씨 정보를 가져오는 데 실패했습니다.)`;
        }
    } catch (error) {
        console.error("Axios request failed (ASOS Monthly):", error.message);
        return `(시스템 정보: ${year}년 ${month}월 날씨 조회 중 오류가 발생했습니다.)`;
    }
};

// Date 객체를 'YYYYMMDD' 형식의 문자열로 변환하는 헬퍼 함수
const formatDate = (d) => {
    const year = d.getFullYear();
    const month = String(d.getMonth() + 1).padStart(2, '0');
    const day = String(d.getDate()).padStart(2, '0');
    return `${year}${month}${day}`;
};

// 날씨 기반 계획 추천 함수
export const getWeatherRecommendation = async (inputDate, lat, lon) => {
    // 월별 조회인지 확인 (예: "2025-07")
    if (typeof inputDate === 'string' && /^\d{4}-\d{2}$/.test(inputDate)) {
        const [year, month] = inputDate.split('-').map(Number);
        return await getMonthlyWeather(year, month);
    }

    // 1. 날짜 포맷 통일 (YYYYMMDD)
    let targetDate;
    if (inputDate instanceof Date) {
        targetDate = formatDate(inputDate); // formatDate는 'YYYYMMDD'를 반환
    } else if (typeof inputDate === 'string') {
        targetDate = inputDate.replace(/-/g, ''); // '2025-07-24' -> '20250724'
    }

    const today = new Date();
    const todayDate = formatDate(today);
    
    const yesterday = new Date(today);
    yesterday.setDate(today.getDate() - 1);
    const yesterdayDate = formatDate(yesterday);


    // 3. 디버깅용 로그 추가
    console.log("선택날짜:", targetDate);
    console.log("오늘날짜:", todayDate);
    console.log("결과:", targetDate < todayDate ? "과거입니다" : "미래/오늘입니다");

    let weatherData = null;

    // 2. 명확한 분기 처리
    if (targetDate < todayDate) {
        // 과거 날짜: ASOS API 호출
        weatherData = await getPastWeather(targetDate);
        
        // 어제 날짜 데이터가 아직 집계되지 않은 경우 처리
        if (!weatherData && targetDate === yesterdayDate) {
            return { 
                score: 50, 
                comment: '어제 날씨 데이터는 아직 기상청에서 정산 중이에요! (보통 오전 11시 이후에 나와요)', 
                temp: null, 
                sky: null, 
                rain: null 
            };
        }

    } else {
        // 오늘 또는 미래 날짜: 단기예보 API 호출
        const forecast = await getShortTermForecast(lat, lon);
        if (forecast) {
            // 단기예보 결과에서 해당 날짜의 데이터 필터링
            const tempItem = forecast.find(item => item.category === 'TMP' && item.fcstDate === targetDate);
            const skyItem = forecast.find(item => item.category === 'SKY' && item.fcstDate === targetDate);
            const ptyItem = forecast.find(item => item.category === 'PTY' && item.fcstDate === targetDate);

            if (tempItem && skyItem && ptyItem) {
                weatherData = {
                    temp: parseInt(tempItem.fcstValue, 10),
                    sky: parseInt(skyItem.fcstValue, 10),
                    pty: parseInt(ptyItem.fcstValue, 10)
                };
            }
        }
    }

    if (!weatherData) {
        return { score: 0, comment: '날씨 정보를 가져오는 데 실패했거나 해당 날짜의 데이터가 없습니다.', temp: null, sky: null, rain: null };
    }

    const isPast = targetDate < todayDate;
    
    let score = 50;
    let comment = '';

    // 점수 계산 로직 (weatherData 객체 속성 사용)
    if (weatherData.pty !== 0) {
        score -= 40;
        comment += isPast ? '비나 눈 소식이 있었네요. ' : '비나 눈 소식이 있어요. ';
    } else {
        if (weatherData.sky === 1) {
            score += 20;
            comment += isPast ? '화창한 날씨였어요! ' : '화창한 날씨예요! ';
        } else if (weatherData.sky === 4) {
            score -= 10;
            comment += isPast ? '조금 흐린 날이었네요. ' : '조금 흐린 날이네요. ';
        }
    }

    if (weatherData.temp >= 15 && weatherData.temp < 26) {
        score += 30;
        comment += isPast ? '쾌적한 기온이라 어떤 활동이든 좋았을 거예요. ' : '쾌적한 기온이라 어떤 활동이든 좋을 거예요. ';
    } else if (weatherData.temp >= 26) {
        score -= 10;
        comment += isPast ? '조금 더운 날씨였어요. ' : '조금 더운 날씨예요. ';
    } else if (weatherData.temp < 5) {
        score -= 20;
        comment += isPast ? '꽤 추운 날이었으니, 따뜻한 추억을 만들었길 바라요. ' : '꽤 추운 날이니, 따뜻하게 보내세요. ';
    }

    const skyState = { 1: '맑음', 3: '구름많음', 4: '흐림' }[weatherData.sky] || '알 수 없음';
    const rainState = { 0: '강수 없음', 1: '비', 2: '비/눈', 3: '눈', 4: '소나기' }[weatherData.pty] || '알 수 없음';

    return { 
        temp: weatherData.temp, 
        sky: skyState, 
        rain: rainState, 
        score, 
        comment: comment.trim() 
    };
};
