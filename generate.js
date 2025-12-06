const https = require('https');
const fs = require('fs');

// 환경 변수 확인
const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

if (!GITHUB_TOKEN || !USERNAME) {
    console.error('Error: GITHUB_TOKEN and USERNAME environment variables are required.');
    process.exit(1);
}

// 1. 데이터 가져오기 (기존과 동일)
async function fetchContributions() {
    const query = `
    query($username: String!) {
        user(login: $username) {
            contributionsCollection {
                contributionCalendar {
                    totalContributions
                    weeks {
                        contributionDays {
                            contributionCount
                            date
                            weekday
                        }
                    }
                }
            }
        }
    }`;

    const body = JSON.stringify({
        query,
        variables: { username: USERNAME }
    });

    return new Promise((resolve, reject) => {
        const req = https.request({
            hostname: 'api.github.com',
            path: '/graphql',
            method: 'POST',
            headers: {
                'Authorization': `Bearer ${GITHUB_TOKEN}`,
                'Content-Type': 'application/json',
                'User-Agent': 'contribution-city-generator'
            }
        }, (res) => {
            let data = '';
            res.on('data', chunk => data += chunk);
            res.on('end', () => {
                try {
                    const json = JSON.parse(data);
                    if (json.errors) {
                        reject(new Error(JSON.stringify(json.errors)));
                    } else {
                        resolve(json.data.user.contributionsCollection.contributionCalendar);
                    }
                } catch (e) {
                    reject(e);
                }
            });
        });
        req.on('error', reject);
        req.write(body);
        req.end();
    });
}

function getLastWeekData(calendar) {
    const allDays = calendar.weeks.flatMap(w => w.contributionDays);
    // 최근 6일치 데이터 사용
    return allDays.slice(-6);
}

// 2. SVG 생성 로직 (대폭 수정됨)
function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // --- 좌표계 설정 ---
    // Isometric Projection: (Grid X, Grid Y) -> (Screen X, Screen Y)
    // originX, originY: 그리드 (0,0)이 화면 어디에 위치할지
    const originX = width / 2; 
    const originY = 150; 
    const tileW = 30; // 타일 하나의 너비 절반
    const tileH = 15; // 타일 하나의 높이 절반

    // 3D 좌표 변환 함수
    const iso = (x, y, z = 0) => {
        return {
            x: originX + (x - y) * tileW,
            y: originY + (x + y) * tileH - z
        };
    };

    // --- 렌더링 헬퍼 함수 ---

    // 1) 3D 픽셀 텍스트
    const drawPixelText = (pos, text, colorTop, colorSide, fontSize = 16) => {
        return `
            <g style="font-family: 'Courier New', monospace; font-weight: bold; font-size: ${fontSize}px">
                <text x="${pos.x + 2}" y="${pos.y + 2}" text-anchor="middle" fill="#000000" opacity="0.5">${text}</text>
                <text x="${pos.x}" y="${pos.y}" text-anchor="middle" fill="${colorTop}">${text}</text>
            </g>
        `;
    };

    // 2) 클래식 가로등 그리기 (참고 이미지 반영)
    const drawClassicLamp = (cx, cy, baseZ) => {
        let svg = '';
        const poleColor = '#1a1a1a'; // 검은색 금속
        const glassColor = '#ffeecc'; // 따뜻한 유리 색
        const lightColor = '#fffebb'; // 불빛

        // 기둥 (얇고 김)
        const poleH = 70;
        const w = 4; // 기둥 두께
        
        // 기둥 받침대
        const bW = 8;
        svg += `<polygon points="
            ${iso(cx-bW, cy-bW, baseZ).x},${iso(cx-bW, cy-bW, baseZ).y}
            ${iso(cx+bW, cy-bW, baseZ).x},${iso(cx+bW, cy-bW, baseZ).y}
            ${iso(cx+bW, cy+bW, baseZ).x},${iso(cx+bW, cy+bW, baseZ).y}
            ${iso(cx-bW, cy+bW, baseZ).x},${iso(cx-bW, cy+bW, baseZ).y}
        " fill="${poleColor}"/>`;

        // 기둥 본체
        // 4면을 그려서 입체감 줌
        const p1 = iso(cx-w, cy-w, baseZ);
        const p2 = iso(cx+w, cy-w, baseZ);
        const p3 = iso(cx+w, cy+w, baseZ);
        const p4 = iso(cx-w, cy+w, baseZ);
        const t1 = iso(cx-w, cy-w, baseZ + poleH);
        const t2 = iso(cx+w, cy-w, baseZ + poleH);
        const t3 = iso(cx+w, cy+w, baseZ + poleH);
        const t4 = iso(cx-w, cy+w, baseZ + poleH);

        svg += `<polygon points="${p2.x},${p2.y} ${t2.x},${t2.y} ${t3.x},${t3.y} ${p3.x},${p3.y}" fill="#333333"/>`; // 우측면
        svg += `<polygon points="${p3.x},${p3.y} ${t3.x},${t3.y} ${t4.x},${t4.y} ${p4.x},${p4.y}" fill="#000000"/>`; // 좌측면

        // 랜턴 헤드 (육각형 느낌의 다면체)
        const headZ = baseZ + poleH;
        const headW = 10;
        const headH = 18;
        
        // 랜턴 바닥
        svg += `<polygon points="${iso(cx-headW, cy-headW, headZ).x},${iso(cx-headW, cy-headW, headZ).y} ${iso(cx+headW, cy-headW, headZ).x},${iso(cx+headW, cy-headW, headZ).y} ${iso(cx+headW, cy+headW, headZ).x},${iso(cx+headW, cy+headW, headZ).y} ${iso(cx-headW, cy+headW, headZ).x},${iso(cx-headW, cy+headW, headZ).y}" fill="${poleColor}"/>`;

        // 랜턴 유리 (빛남)
        const g1 = iso(cx-headW+2, cy+headW-2, headZ);
        const g2 = iso(cx+headW-2, cy+headW-2, headZ);
        const g3 = iso(cx+headW-2, cy+headW-2, headZ + headH);
        const g4 = iso(cx-headW+2, cy+headW-2, headZ + headH);
        svg += `<polygon points="${g1.x},${g1.y} ${g2.x},${g2.y} ${g3.x},${g3.y} ${g4.x},${g4.y}" fill="${glassColor}" opacity="0.9" class="lamp-glow"/>`; // 앞유리
        
        const g5 = iso(cx+headW-2, cy-headW+2, headZ);
        const g6 = iso(cx+headW-2, cy+headW-2, headZ);
        const g7 = iso(cx+headW-2, cy+headW-2, headZ + headH);
        const g8 = iso(cx+headW-2, cy-headW+2, headZ + headH);
        svg += `<polygon points="${g5.x},${g5.y} ${g6.x},${g6.y} ${g7.x},${g7.y} ${g8.x},${g8.y}" fill="${glassColor}" opacity="0.8" class="lamp-glow"/>`; // 옆유리

        // 랜턴 지붕 (뾰족하게)
        const topZ = headZ + headH;
        const peakZ = topZ + 10;
        const roof1 = iso(cx-headW-2, cy+headW+2, topZ);
        const roof2 = iso(cx+headW+2, cy+headW+2, topZ);
        const roof3 = iso(cx+headW+2, cy-headW-2, topZ);
        const peak = iso(cx, cy, peakZ);
        
        svg += `<polygon points="${roof2.x},${roof2.y} ${roof3.x},${roof3.y} ${peak.x},${peak.y}" fill="#333333"/>`;
        svg += `<polygon points="${roof1.x},${roof1.y} ${roof2.x},${roof2.y} ${peak.x},${peak.y}" fill="#111111"/>`;

        // 바닥 빛 번짐
        svg += `<ellipse cx="${iso(cx, cy).x}" cy="${iso(cx, cy).y}" rx="30" ry="15" fill="#ffdd66" opacity="0.25" class="lamp-glow"/>`;

        return svg;
    };

    // 3) 건물 그리기
    const drawBuilding = (cx, cy, count, dayName) => {
        let svg = '';
        const w = 18; // 건물 너비 (Grid 단위 아님, 픽셀 오프셋)
        const d = 18; // 건물 깊이
        const h = Math.min(180, 40 + count * 20); // 높이 계산
        
        // 색상
        const cTop = '#6a6a5a';
        const cSideL = '#4a4a3a'; // 왼쪽면 (어두움)
        const cSideR = '#5a5a4a'; // 오른쪽면 (밝음)
        const winOn = '#ffdd66';
        const winOff = '#2a2a22';

        // 좌표 계산
        // cx, cy는 그리드 좌표값
        // 실제 스크린 좌표의 중심점
        const center = iso(cx, cy, 0);
        
        // 건물의 4개 모서리 (바닥)
        // 화면상 좌우로 퍼지게 하기 위해 오프셋 적용
        const p1 = { x: center.x, y: center.y + tileH }; // Bottom
        const p2 = { x: center.x + tileW/1.5, y: center.y }; // Right
        const p3 = { x: center.x, y: center.y - tileH }; // Top (Back)
        const p4 = { x: center.x - tileW/1.5, y: center.y }; // Left

        // 건물의 4개 모서리 (지붕)
        const t1 = { x: p1.x, y: p1.y - h };
        const t2 = { x: p2.x, y: p2.y - h };
        const t3 = { x: p3.x, y: p3.y - h };
        const t4 = { x: p4.x, y: p4.y - h };

        // 1. 벽면 그리기
        // Right Face (오른쪽 아래)
        svg += `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${t2.x},${t2.y} ${t1.x},${t1.y}" fill="${cSideR}" stroke="#111" stroke-width="1"/>`;
        // Left Face (왼쪽 아래)
        svg += `<polygon points="${p1.x},${p1.y} ${p4.x},${p4.y} ${t4.x},${t4.y} ${t1.x},${t1.y}" fill="${cSideL}" stroke="#111" stroke-width="1"/>`;
        // Roof (지붕)
        svg += `<polygon points="${t1.x},${t1.y} ${t2.x},${t2.y} ${t3.x},${t3.y} ${t4.x},${t4.y}" fill="${cTop}" stroke="#111" stroke-width="1"/>`;

        // 2. 창문 그리기 (Right Face & Left Face)
        const rows = Math.floor(h / 15);
        
        // Right Face Windows
        for(let r=1; r<rows; r++) {
            const wz = r * 15 + 10;
            if(wz > h - 10) break;
            const isLit = Math.random() > 0.4 || count > 0;
            const wc = isLit ? winOn : winOff;
            
            // 3D 면 위에 창문 투영
            // 간단히 선형 보간 사용
            const wx1 = p1.x + (p2.x - p1.x) * 0.3;
            const wy1 = (p1.y - wz) + (p2.y - p1.y) * 0.3;
            const wx2 = p1.x + (p2.x - p1.x) * 0.7;
            const wy2 = (p1.y - wz) + (p2.y - p1.y) * 0.7;
            
            svg += `<polygon points="${wx1},${wy1} ${wx2},${wy2} ${wx2},${wy2-8} ${wx1},${wy1-8}" fill="${wc}" class="${isLit?'window':''}"/>`;
        }
        
        // Left Face Windows
        for(let r=1; r<rows; r++) {
            const wz = r * 15 + 10;
            if(wz > h - 10) break;
            const isLit = Math.random() > 0.4 || count > 0;
            const wc = isLit ? winOn : winOff;
            
            const wx1 = p1.x + (p4.x - p1.x) * 0.3;
            const wy1 = (p1.y - wz) + (p4.y - p1.y) * 0.3;
            const wx2 = p1.x + (p4.x - p1.x) * 0.7;
            const wy2 = (p1.y - wz) + (p4.y - p1.y) * 0.7;

            svg += `<polygon points="${wx1},${wy1} ${wx2},${wy2} ${wx2},${wy2-8} ${wx1},${wy1-8}" fill="${wc}" class="${isLit?'window':''}"/>`;
        }

        // 3. 텍스트 라벨 (건물 위)
        svg += drawPixelText({x: t1.x, y: t1.y - 30}, dayName, '#4a90e2', '#357abd');
        svg += drawPixelText({x: t1.x, y: t1.y - 15}, count, '#ffdd66', '#e6c35c');

        return svg;
    };

    // --- 메인 드로잉 로직 ---
    
    // 1. 배경 요소
    const sky = `<rect width="${width}" height="${height}" fill="#0a0a15"/>`; // 더 어두운 밤하늘
    let stars = '';
    for (let i = 0; i < 60; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height * 0.7;
        const r = Math.random() * 1.5;
        const delay = Math.random() * 3;
        stars += `<circle cx="${sx}" cy="${sy}" r="${r}" fill="white" class="star" style="animation-delay: ${delay}s"/>`;
    }

    // 2. 바닥 (잔디 & 도로)
    // 잔디: 큰 다이아몬드
    // (0,0) ~ (12, 12) 정도의 크기
    const g1 = iso(0, 0);
    const g2 = iso(12, 0);
    const g3 = iso(12, 12);
    const g4 = iso(0, 12);
    const grass = `<polygon points="${g1.x},${g1.y} ${g2.x},${g2.y} ${g3.x},${g3.y} ${g4.x},${g4.y}" fill="#1a3a1a" stroke="#111"/>`;
    
    // 잔디 텍스처
    let grassDetail = '';
    for(let i=0; i<30; i++) {
        const rx = Math.random() * 11;
        const ry = Math.random() * 11;
        const pos = iso(rx, ry);
        grassDetail += `<rect x="${pos.x}" y="${pos.y}" width="2" height="2" fill="#2a5a2a" opacity="0.6"/>`;
    }

    // 도로: 잔디의 오른쪽 아래(South-East) 모서리를 따라 배치
    // (12, 0) ~ (12, 12) 라인 옆
    const r1 = iso(12, 0); // Road Start Inner
    const r2 = iso(15, 0); // Road Start Outer
    const r3 = iso(15, 12); // Road End Outer
    const r4 = iso(12, 12); // Road End Inner
    const road = `<polygon points="${r1.x},${r1.y} ${r2.x},${r2.y} ${r3.x},${r3.y} ${r4.x},${r4.y}" fill="#2a2a2a" stroke="#111"/>`;
    const roadLine = `<line x1="${iso(13.5, 0).x}" y1="${iso(13.5, 0).y}" x2="${iso(13.5, 12).x}" y2="${iso(13.5, 12).y}" stroke="#555" stroke-width="2" stroke-dasharray="10,10"/>`;

    // 3. 객체 정렬 및 그리기 (Painter's Algorithm)
    // 뒤(Far) -> 앞(Near) 순서로 그려야 함.
    // Isometric에서 '뒤'는 x+y 값이 작은 곳, '앞'은 x+y 값이 큰 곳 (화면상 위->아래)
    // 혹은 북동쪽(Top-Right)으로 뻗어나가는 경우 화면 위쪽이 뒤쪽임.
    
    // 객체 리스트 생성
    let objects = [];

    // 데이터 기반 건물/가로등 추가
    // 배치를 (2,2) ~ (2+N, 2+N) 대각선으로 하거나
    // (2, 10) ~ (10, 2) 이런식으로 가로질러 배치.
    // "북동쪽" 느낌을 주려면 화면 왼쪽 아래에서 오른쪽 위로 뻗어야 함.
    // Grid상에서 x는 증가, y는 감소 하면 북동쪽(Screen Top-Right)으로 감.
    
    weekData.forEach((day, index) => {
        const count = day.contributionCount;
        // x는 증가, y는 동일하게 유지하면 오른쪽 아래로 감 (X)
        // x는 증가, y는 감소하면 오른쪽 위로 감 (O) -> 북동쪽
        // 시작점 (2, 10) -> 끝점 (8, 4)
        const gx = 2 + index; 
        const gy = 10 - index; 

        objects.push({
            type: count === 0 ? 'lamp' : 'building',
            gx: gx,
            gy: gy,
            sortKey: gx + gy, // Isometric depth sorting key
            data: day
        });
    });

    // 자동차 (도로 위)
    objects.push({ type: 'car', gx: 13.5, gy: 3, sortKey: 16.5, color: '#357abd' });
    objects.push({ type: 'car', gx: 13.5, gy: 9, sortKey: 22.5, color: '#e74c3c' });

    // 정렬 (SortKey가 작은 것부터 그리면 됨 -> 화면 위쪽부터)
    objects.sort((a, b) => a.sortKey - b.sortKey);

    let objectsSvg = '';
    objects.forEach(obj => {
        if (obj.type === 'building') {
            objectsSvg += drawBuilding(obj.gx, obj.gy, obj.data.contributionCount, dayNames[obj.data.weekday]);
        } else if (obj.type === 'lamp') {
            // 전등 라벨도 추가
            const pos = iso(obj.gx, obj.gy, 80);
            objectsSvg += drawClassicLamp(obj.gx, obj.gy, 0);
            objectsSvg += drawPixelText({x: pos.x, y: pos.y - 15}, dayNames[obj.data.weekday], '#888', '#666', 12);
            objectsSvg += drawPixelText({x: pos.x, y: pos.y}, "0", '#ffdd66', '#e6c35c', 14);
        } else if (obj.type === 'car') {
            // 자동차 렌더링 (간단 픽셀)
            const cx = obj.gx;
            const cy = obj.gy;
            const cz = 0;
            const center = iso(cx, cy, cz);
            // 차체
            objectsSvg += `<g>`;
            objectsSvg += `<polygon points="${center.x-10},${center.y} ${center.x+10},${center.y+10} ${center.x+10},${center.y-5} ${center.x-10},${center.y-15}" fill="${obj.color}" stroke="#111"/>`;
            objectsSvg += `<polygon points="${center.x-10},${center.y-15} ${center.x+10},${center.y-5} ${center.x+10},${center.y-15} ${center.x-10},${center.y-25}" fill="${obj.color}" filter="brightness(1.2)"/>`;
            // 헤드라이트
            objectsSvg += `<circle cx="${center.x-8}" cy="${center.y-8}" r="2" fill="#fff"/>`;
            objectsSvg += `</g>`;
        }
    });

    // 4. SVG 조립
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#050510"/>
                <stop offset="100%" stop-color="#151525"/>
            </linearGradient>
            <style>
                @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
                @keyframes flicker { 0%, 90%, 100% { opacity: 1; } 95% { opacity: 0.7; } }
                @keyframes lampPulse { 0%, 100% { opacity: 0.2; } 50% { opacity: 0.35; } }
                .star { animation: twinkle 3s infinite; }
                .window { animation: flicker 5s infinite alternate; }
                .lamp-glow { animation: lampPulse 4s infinite; }
            </style>
        </defs>
        
        <rect width="${width}" height="${height}" fill="url(#skyGrad)"/>
        ${stars}
        
        <circle cx="800" cy="80" r="40" fill="#ffffee" opacity="0.9"/>
        <circle cx="785" cy="70" r="8" fill="#ddd" opacity="0.3"/>
        <circle cx="810" cy="90" r="5" fill="#ddd" opacity="0.3"/>

        <g transform="translate(0, 50)">
            ${grass}
            ${grassDetail}
            ${road}
            ${roadLine}
            ${objectsSvg}
        </g>

        <g font-family="'Courier New', monospace" font-weight="bold">
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="32" stroke="#000" stroke-width="3" paint-order="stroke">Contribution City</text>
            <text x="30" y="${height - 60}" fill="#fff" font-size="20">TOTAL: <tspan fill="#ffdd66">${totalContributions}</tspan></text>
            <text x="30" y="${height - 30}" fill="#fff" font-size="20">TODAY: <tspan fill="#ffdd66">${weekData[weekData.length-1].contributionCount}</tspan></text>
        </g>
    </svg>`;
}

// 3. 실행 함수
async function main() {
    try {
        console.log(`Fetching contributions for ${USERNAME}...`);
        const calendar = await fetchContributions();
        console.log(`Total contributions: ${calendar.totalContributions}`);
        
        const weekData = getLastWeekData(calendar);
        console.log('Last 6 days data:', weekData.map(d => `${d.date}: ${d.contributionCount}`).join(', '));
        
        const svg = generateSVG(weekData, calendar.totalContributions);
        
        const outputDir = 'profile-3d-contrib';
        if (!fs.existsSync(outputDir)) fs.mkdirSync(outputDir);
        fs.writeFileSync(`${outputDir}/contribution-city.svg`, svg);
        console.log(`Generated: ${outputDir}/contribution-city.svg`);
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();