const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

if (!GITHUB_TOKEN || !USERNAME) {
    console.error('Error: GITHUB_TOKEN and USERNAME environment variables are required.');
    process.exit(1);
}

// 1. 데이터 가져오기
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
    return allDays.slice(-7);
}

// --- 도트 폰트 데이터 (5x7) ---
const dotFont = {
    '0': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    '1': [[0,1,0],[1,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    '2': [[1,1,1],[0,0,1],[0,0,1],[1,1,1],[1,0,0],[1,0,0],[1,1,1]],
    '3': [[1,1,1],[0,0,1],[0,0,1],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    '4': [[1,0,1],[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1],[0,0,1]],
    '5': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    '6': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[1,0,1],[1,0,1],[1,1,1]],
    '7': [[1,1,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1],[0,0,1]],
    '8': [[1,1,1],[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,1,1]],
    '9': [[1,1,1],[1,0,1],[1,0,1],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    'S': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[0,0,1],[0,0,1],[1,1,1]],
    'U': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    'N': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1]],
    'M': [[1,0,1],[1,1,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1]],
    'O': [[1,1,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1]],
    'T': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    'W': [[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,1],[1,1,1],[1,0,1]],
    'E': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[1,0,0],[1,0,0],[1,1,1]],
    'D': [[1,1,0],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,0,1],[1,1,0]],
    'H': [[1,0,1],[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    'F': [[1,1,1],[1,0,0],[1,0,0],[1,1,1],[1,0,0],[1,0,0],[1,0,0]],
    'R': [[1,1,0],[1,0,1],[1,0,1],[1,1,0],[1,0,1],[1,0,1],[1,0,1]],
    'I': [[1,1,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[0,1,0],[1,1,1]],
    'A': [[0,1,0],[1,0,1],[1,0,1],[1,1,1],[1,0,1],[1,0,1],[1,0,1]],
    'L': [[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,0,0],[1,1,1]],
    'Y': [[1,0,1],[1,0,1],[1,0,1],[0,1,0],[0,1,0],[0,1,0],[0,1,0]],
    ' ': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]
};

// SVG 생성 로직
function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];

    // --- 좌표계 설정 ---
    const tileW = 36;
    const tileH = 18;
    const originX = 450; // 화면 중앙
    const originY = 250; // 화면 중앙으로 이동 (시점 변경 대응)

    // Isometric 변환 (표준)
    const iso = (gx, gy, gz = 0) => {
        return {
            x: originX + (gx - gy) * tileW,
            y: originY + (gx + gy) * tileH - gz
        };
    };

    // --- 그리기 헬퍼: 큐브(Block) ---
    const drawBlock = (gx, gy, gz, w, d, h, colors) => {
        const p0 = iso(gx, gy, gz + h);          // Top-Back-Left
        const p1 = iso(gx + w, gy, gz + h);      // Top-Back-Right
        const p2 = iso(gx + w, gy + d, gz + h);  // Top-Front-Right
        const p3 = iso(gx, gy + d, gz + h);      // Top-Front-Left
        const p4 = iso(gx + w, gy + d, gz);      // Bottom-Front-Right
        const p5 = iso(gx, gy + d, gz);          // Bottom-Front-Left
        const p6 = iso(gx + w, gy, gz);          // Bottom-Back-Right

        let svg = '';
        // Top Face
        svg += `<polygon points="${p0.x},${p0.y} ${p1.x},${p1.y} ${p2.x},${p2.y} ${p3.x},${p3.y}" fill="${colors.top}"/>`;
        // Right Face
        svg += `<polygon points="${p1.x},${p1.y} ${p2.x},${p2.y} ${p4.x},${p4.y} ${p6.x},${p6.y}" fill="${colors.right}"/>`;
        // Left Face
        svg += `<polygon points="${p3.x},${p3.y} ${p2.x},${p2.y} ${p4.x},${p4.y} ${p5.x},${p5.y}" fill="${colors.left}"/>`;
        return svg;
    };

    // --- 텍스트 그리기 (Voxel Text) ---
    const drawVoxelText = (text, startGx, startGy, startGz, color) => {
        let svg = '';
        let offset = 0;
        const scale = 0.12;
        for (const char of text.toUpperCase()) {
            const pattern = dotFont[char] || dotFont[' '];
            const charW = pattern[0].length;
            for (let r = 0; r < pattern.length; r++) {
                for (let c = 0; c < pattern[r].length; c++) {
                    if (pattern[r][c]) {
                        // 텍스트를 정면(왼쪽 면)을 바라보게 세움
                        const vx = startGx + (offset + c) * scale * 2; // 가로 배치
                        const vy = startGy; // 깊이 고정
                        const vz = startGz + (pattern.length - r) * scale * 25; // 높이

                        svg += drawBlock(vx, vy, vz, scale*2, scale, scale*25, {
                            top: color, right: '#111', left: color
                        });
                    }
                }
            }
            offset += charW + 1;
        }
        return svg;
    };

    // --- 렌더링 큐 (Painter's Algorithm) ---
    let renderQueue = [];

    // **시점 변경 핵심: 좌표 재배치**
    // 도로: 앞쪽(gy가 작음), 잔디: 뒤쪽(gy가 큼), 건물: 그 사이에서 좌우(gx)로 나열

    // 1. 도로 (앞쪽)
    renderQueue.push({
        depth: -200, // 가장 먼저 그려짐
        draw: () => {
            let s = '';
            const roadColor = { top: '#333333', right: '#222222', left: '#2a2a2a' };
            // gx를 넓게, gy를 앞쪽에 배치
            s += drawBlock(-7, -2, 0, 14, 3, 0.2, roadColor);
            // 차선
            for (let x = -6; x < 7; x += 2) {
                s += drawBlock(x, -0.5, 0.25, 1, 0.1, 0.05, { top: '#ffcc00', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 2. 잔디 (뒤쪽)
    renderQueue.push({
        depth: -100,
        draw: () => {
            let s = '';
            const grassColor = { top: '#2d4c1e', right: '#1f3815', left: '#1a2e12' };
            // gx를 넓게, gy를 도로 뒤쪽에 배치
            s += drawBlock(-8, 1, 0, 16, 10, 1.5, grassColor);
            // 디테일
            for(let i=0; i<50; i++) {
                const rx = -7 + Math.random() * 14;
                const ry = 1.5 + Math.random() * 9;
                s += drawBlock(rx, ry, 1.5, 0.1, 0.1, 0.1, { top: '#4ca64c', right: 'none', left: 'none' });
            }
            return s;
        }
    });

    // 3. 건물 및 데이터 객체 (도로와 잔디 경계에 좌우로 나열)
    weekData.forEach((day, idx) => {
        const count = day.contributionCount;
        
        // 배치: gy는 고정(잔디 앞부분), gx는 왼쪽에서 오른쪽으로 증가
        const gx = -5 + idx * 1.8; // 좌우 간격 조절
        const gy = 1.2; // 도로 바로 뒤
        
        const depth = gx + gy; // 표준 깊이 정렬

        renderQueue.push({
            depth: depth,
            draw: () => {
                let s = '';
                if (count === 0) {
                    // === 가로등 ===
                    const poleColor = { top: '#1a1a1a', right: '#000000', left: '#111111' };
                    s += drawBlock(gx+0.35, gy+0.35, 1.5, 0.3, 0.3, 50, poleColor);
                    s += drawBlock(gx+0.2, gy+0.2, 51.5, 0.6, 0.6, 1, poleColor);
                    const glassColor = { top: '#fff9c4', right: '#fff176', left: '#ffee58' };
                    s += drawBlock(gx+0.25, gy+0.25, 52.5, 0.5, 0.5, 10, glassColor);
                    s += drawBlock(gx+0.15, gy+0.15, 62.5, 0.7, 0.7, 2, poleColor);
                    s += drawBlock(gx+0.4, gy+0.4, 64.5, 0.2, 0.2, 3, poleColor);

                    const center = iso(gx+0.5, gy+0.5, 1.6);
                    s += `<circle cx="${center.x}" cy="${center.y}" r="20" fill="#fff176" opacity="0.15" class="lamp-glow"/>`;
                    // 텍스트 위치 조정
                    s += drawVoxelText(dayNames[day.weekday], gx-0.2, gy, 75, '#8899aa');

                } else {
                    // === 건물 ===
                    const h = Math.min(140, 30 + count * 12);
                    const bColor = { top: '#546e7a', right: '#37474f', left: '#455a64' };
                    s += drawBlock(gx, gy, 1.5, 1.2, 0.9, h, bColor); // 너비 약간 증가

                    const winRows = Math.floor(h / 12);
                    for (let r = 1; r < winRows; r++) {
                        const wz = 1.5 + r * 12;
                        const isLit = Math.random() > 0.4;
                        const wColor = isLit ? { top: '#fdd835', right: '#fbc02d', left: '#ffeb3b' } 
                                             : { top: '#263238', right: '#102027', left: '#1c262b' };
                        
                        // 정면(Left Face) 창문 강조
                        s += drawBlock(gx-0.05, gy+0.1, wz, 0.1, 0.3, 5, wColor);
                        s += drawBlock(gx-0.05, gy+0.5, wz, 0.1, 0.3, 5, wColor);
                        
                        // 측면(Right Face) 창문
                        if (r % 2 === 0) {
                             s += drawBlock(gx+0.1, gy+0.85, wz, 0.3, 0.1, 5, wColor);
                             s += drawBlock(gx+0.8, gy+0.85, wz, 0.3, 0.1, 5, wColor);
                        }
                    }
                    // 텍스트 위치 조정
                    s += drawVoxelText(dayNames[day.weekday], gx, gy, h + 15, '#90a4ae');
                    s += drawVoxelText(count.toString(), gx+0.3, gy, h + 5, '#fdd835');
                }
                return s;
            }
        });
    });

    // 4. 자동차 (도로 위, 왼쪽에서 오른쪽으로 주행)
    renderQueue.push({
        depth: -50, // 도로와 건물 사이 depth
        draw: () => {
            let s = '';
            const cx = -3; // 도로 왼쪽편
            const cy = -1; // 도로 위
            const cz = 0.2;
            
            // 차체 (파란색) - 옆모습이 보이게 w를 길게
            s += drawBlock(cx, cy, cz, 3, 1.2, 3, { top: '#42a5f5', right: '#1e88e5', left: '#2196f3' });
            // 지붕
            s += drawBlock(cx+0.5, cy+0.1, cz+3, 2, 1, 2, { top: '#111', right: '#111', left: '#111' });
            // 헤드라이트 (오른쪽 면에 배치)
            s += drawBlock(cx+2.9, cy+0.2, cz+1, 0.1, 0.3, 1, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            s += drawBlock(cx+2.9, cy+0.7, cz+1, 0.1, 0.3, 1, { top: '#ffeb3b', right: '#ffeb3b', left: '#ffeb3b' });
            
            return s;
        }
    });

    // --- 정렬 및 그리기 ---
    renderQueue.sort((a, b) => a.depth - b.depth);

    let objectsSvg = '';
    renderQueue.forEach(obj => {
        objectsSvg += obj.draw();
    });

    // --- 배경 및 최종 조립 (기존과 동일) ---
    let stars = '';
    for (let i = 0; i < 50; i++) {
        const sx = Math.random() * width;
        const sy = Math.random() * height * 0.6;
        const r = Math.random() * 1.5;
        const delay = Math.random() * 3;
        stars += `<rect x="${sx}" y="${sy}" width="${r*2}" height="${r*2}" fill="white" class="star" style="animation-delay: ${delay}s"/>`;
    }

    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
        <defs>
            <linearGradient id="skyGrad" x1="0" y1="0" x2="0" y2="1">
                <stop offset="0%" stop-color="#0d1b2a"/>
                <stop offset="100%" stop-color="#1b263b"/>
            </linearGradient>
            <style>
                @keyframes twinkle { 0%, 100% { opacity: 0.3; } 50% { opacity: 1; } }
                @keyframes lampPulse { 0%, 100% { opacity: 0.15; } 50% { opacity: 0.3; } }
                .star { animation: twinkle 3s infinite; }
                .lamp-glow { animation: lampPulse 4s infinite; }
            </style>
        </defs>
        <rect width="${width}" height="${height}" fill="url(#skyGrad)"/>
        ${stars}
        <g transform="translate(800, 70)">
             <rect x="-20" y="-20" width="40" height="40" fill="#fff59d"/>
             <rect x="-25" y="-10" width="5" height="20" fill="#fff59d"/>
             <rect x="20" y="-10" width="5" height="20" fill="#fff59d"/>
             <rect x="-10" y="-25" width="20" height="5" fill="#fff59d"/>
             <rect x="-10" y="20" width="20" height="5" fill="#fff59d"/>
             <rect x="-10" y="-5" width="8" height="8" fill="#e6ee9c" opacity="0.6"/>
        </g>
        <g transform="translate(0, 50)">
            ${objectsSvg}
        </g>
        <g font-family="'Courier New', monospace" font-weight="bold">
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="28" stroke="#000" stroke-width="4" paint-order="stroke">CONTRIBUTION CITY</text>
            <text x="${width/2}" y="50" text-anchor="middle" fill="#fff" font-size="28">CONTRIBUTION CITY</text>
            <text x="30" y="${height - 50}" fill="#cfd8dc" font-size="16">TOTAL: <tspan fill="#fdd835">${totalContributions}</tspan></text>
            <text x="30" y="${height - 25}" fill="#cfd8dc" font-size="16">TODAY: <tspan fill="#fdd835">${weekData[weekData.length-1].contributionCount}</tspan></text>
        </g>
    </svg>`;

    return svg;
}

async function main() {
    try {
        console.log(`Fetching contributions for ${USERNAME}...`);
        const calendar = await fetchContributions();
        console.log(`Total contributions: ${calendar.totalContributions}`);
        const weekData = getLastWeekData(calendar);
        console.log('Last 7 days:', weekData.map(d => `${d.date}: ${d.contributionCount}`).join(', '));
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