const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

// GraphQL 쿼리
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

// 도트 폰트 정의 (5x7 그리드)
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
    ':': [[0],[0],[1],[0],[0],[1],[0]],
    ' ': [[0,0],[0,0],[0,0],[0,0],[0,0],[0,0],[0,0]]
};

// 도트 텍스트를 등각투영 SVG로 변환
function drawDotText(text, baseX, baseY, baseZ, pixelSize, color, isoX, isoY) {
    let svg = '';
    let offsetX = 0;
    
    for (const char of text.toUpperCase()) {
        const pattern = dotFont[char] || dotFont[' '];
        const charWidth = pattern[0].length;
        
        for (let row = 0; row < pattern.length; row++) {
            for (let col = 0; col < pattern[row].length; col++) {
                if (pattern[row][col]) {
                    const px = baseX + (offsetX + col) * pixelSize;
                    const py = baseY;
                    const pz = baseZ - row * pixelSize;
                    
                    // 등각투영 픽셀 (작은 마름모)
                    const cx = isoX(px, py);
                    const cy = isoY(px, py, pz);
                    const s = pixelSize * 0.5;
                    
                    svg += `<polygon points="${cx},${cy-s*0.5} ${cx+s*0.7},${cy} ${cx},${cy+s*0.5} ${cx-s*0.7},${cy}" fill="${color}"/>`;
                }
            }
        }
        offsetX += charWidth + 1;
    }
    return svg;
}

function generateSVG(weekData, totalContributions) {
    const width = 900;
    const height = 500;
    
    // 등각투영 (오른쪽 아래로 내려가는 방향)
    const isoX = (x, y) => 450 + (x - y) * 0.6;
    const isoY = (x, y, z) => 250 + (x + y) * 0.35 - z;
    
    const dayNames = ['SUN', 'MON', 'TUE', 'WED', 'THU', 'FRI', 'SAT'];
    
    let buildings = '';
    let labels = '';
    let stars = '';
    
    // 별
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 150;
        const r = Math.random() * 1.5 + 0.5;
        const delay = (Math.random() * 3).toFixed(1);
        stars += `<circle class="star" cx="${x}" cy="${y}" r="${r}" fill="white" style="animation-delay: ${delay}s"/>`;
    }
    
    const todayContributions = weekData[weekData.length - 1].contributionCount;
    
    // 건물 설정
    const buildingWidth = 55;
    const buildingDepth = 35;
    const spacing = 75;
    const maxHeight = 150;
    
    // 건물 그리기 (왼쪽부터 오른쪽으로, 뒤에서 앞으로)
    for (let i = 6; i >= 0; i--) {
        const day = weekData[i];
        const count = day.contributionCount;
        
        // 위치 계산 (왼쪽 위에서 오른쪽 아래로)
        const posX = -100 + i * spacing;
        const posY = -100 + i * spacing;
        
        if (count === 0) {
            // 가로등
            const lampX = isoX(posX + 25, posY + 15);
            const lampBaseY = isoY(posX + 25, posY + 15, 0);
            const lampTopY = isoY(posX + 25, posY + 15, 70);
            
            buildings += `
                <g class="lamp">
                    <rect x="${lampX - 2}" y="${lampTopY}" width="4" height="${lampBaseY - lampTopY}" fill="#4a4a4a"/>
                    <ellipse cx="${lampX}" cy="${lampTopY - 3}" rx="10" ry="5" fill="#3a3a3a"/>
                    <ellipse class="lamp-glow" cx="${lampX}" cy="${lampTopY}" rx="18" ry="9" fill="#ffdd66" opacity="0.4"/>
                    <ellipse cx="${lampX}" cy="${lampTopY - 2}" rx="6" ry="3" fill="#ffeeaa"/>
                    <polygon points="${lampX - 12},${lampTopY + 3} ${lampX + 12},${lampTopY + 3} ${lampX + 20},${lampBaseY - 15} ${lampX - 20},${lampBaseY - 15}" fill="#ffdd66" opacity="0.08"/>
                </g>
            `;
            
            // 도트 라벨
            labels += drawDotText(dayNames[day.weekday], posX + 5, posY, 90, 3, '#7788aa', isoX, isoY);
            labels += drawDotText(count.toString(), posX + 12, posY, 75, 3.5, '#ffdd66', isoX, isoY);
            
        } else {
            // 건물 높이
            const bHeight = Math.max(35, (count / 20) * maxHeight);
            
            // 건물 꼭지점
            const p = {
                f1: { x: isoX(posX, posY), y: isoY(posX, posY, 0) },
                f2: { x: isoX(posX + buildingWidth, posY), y: isoY(posX + buildingWidth, posY, 0) },
                f3: { x: isoX(posX + buildingWidth, posY + buildingDepth), y: isoY(posX + buildingWidth, posY + buildingDepth, 0) },
                f4: { x: isoX(posX, posY + buildingDepth), y: isoY(posX, posY + buildingDepth, 0) },
                t1: { x: isoX(posX, posY), y: isoY(posX, posY, bHeight) },
                t2: { x: isoX(posX + buildingWidth, posY), y: isoY(posX + buildingWidth, posY, bHeight) },
                t3: { x: isoX(posX + buildingWidth, posY + buildingDepth), y: isoY(posX + buildingWidth, posY + buildingDepth, bHeight) },
                t4: { x: isoX(posX, posY + buildingDepth), y: isoY(posX, posY + buildingDepth, bHeight) }
            };
            
            // 색상
            const frontColor = '#5a5a4a';
            const rightColor = '#4a4a3a';
            const roofColor = '#6a6a5a';
            
            // 창문 (정면 - 도로에서 보이는 쪽)
            let windows = '';
            const winRows = Math.floor((bHeight - 15) / 22);
            const winCols = 3;
            
            for (let row = 0; row < winRows; row++) {
                for (let col = 0; col < winCols; col++) {
                    const wz = bHeight - 12 - row * 22;
                    if (wz < 10) continue;
                    
                    // 정면 창문 (posY 쪽)
                    const wx = posX + 8 + col * 16;
                    const wy = posY + 2;
                    
                    const isLit = Math.random() > 0.25;
                    const glowColor = isLit ? '#ffdd66' : '#1a1a15';
                    const opacity = isLit ? '0.9' : '0.8';
                    
                    const w1 = isoX(wx, wy);
                    const h1 = isoY(wx, wy, wz);
                    const w2 = isoX(wx + 10, wy);
                    const h2 = isoY(wx + 10, wy, wz);
                    const w3 = isoX(wx + 10, wy);
                    const h3 = isoY(wx + 10, wy, wz - 14);
                    const w4 = isoX(wx, wy);
                    const h4 = isoY(wx, wy, wz - 14);
                    
                    windows += `<polygon class="window" points="${w1},${h1} ${w2},${h2} ${w3},${h3} ${w4},${h4}" fill="${glowColor}" opacity="${opacity}"/>`;
                }
            }
            
            // 오른쪽 면 창문
            for (let row = 0; row < winRows; row++) {
                for (let col = 0; col < 2; col++) {
                    const wz = bHeight - 12 - row * 22;
                    if (wz < 10) continue;
                    
                    const wx = posX + buildingWidth - 2;
                    const wy = posY + 8 + col * 14;
                    
                    const isLit = Math.random() > 0.25;
                    const glowColor = isLit ? '#ffcc44' : '#151510';
                    const opacity = isLit ? '0.85' : '0.8';
                    
                    const w1 = isoX(wx, wy);
                    const h1 = isoY(wx, wy, wz);
                    const w2 = isoX(wx, wy + 8);
                    const h2 = isoY(wx, wy + 8, wz);
                    const w3 = isoX(wx, wy + 8);
                    const h3 = isoY(wx, wy + 8, wz - 14);
                    const w4 = isoX(wx, wy);
                    const h4 = isoY(wx, wy, wz - 14);
                    
                    windows += `<polygon class="window" points="${w1},${h1} ${w2},${h2} ${w3},${h3} ${w4},${h4}" fill="${glowColor}" opacity="${opacity}"/>`;
                }
            }
            
            buildings += `
                <g class="building">
                    <!-- 정면 (도로쪽) -->
                    <polygon points="${p.f1.x},${p.f1.y} ${p.t1.x},${p.t1.y} ${p.t2.x},${p.t2.y} ${p.f2.x},${p.f2.y}" fill="${frontColor}"/>
                    <!-- 오른쪽 면 -->
                    <polygon points="${p.f2.x},${p.f2.y} ${p.t2.x},${p.t2.y} ${p.t3.x},${p.t3.y} ${p.f3.x},${p.f3.y}" fill="${rightColor}"/>
                    <!-- 지붕 -->
                    <polygon points="${p.t1.x},${p.t1.y} ${p.t2.x},${p.t2.y} ${p.t3.x},${p.t3.y} ${p.t4.x},${p.t4.y}" fill="${roofColor}"/>
                    <!-- 창문 -->
                    ${windows}
                </g>
            `;
            
            // 도트 라벨
            labels += drawDotText(dayNames[day.weekday], posX + 5, posY - 5, bHeight + 25, 3, '#7788aa', isoX, isoY);
            labels += drawDotText(count.toString(), posX + 15, posY - 5, bHeight + 12, 4, '#ffdd66', isoX, isoY);
        }
    }
    
    // 도로
    const road = `
        <polygon points="
            ${isoX(-180, 50)},${isoY(-180, 50, 0)}
            ${isoX(500, 50)},${isoY(500, 50, 0)}
            ${isoX(500, 90)},${isoY(500, 90, 0)}
            ${isoX(-180, 90)},${isoY(-180, 90, 0)}
        " fill="#2a2a2a"/>
        <line x1="${isoX(-150, 70)}" y1="${isoY(-150, 70, 0)}" x2="${isoX(480, 70)}" y2="${isoY(480, 70, 0)}" stroke="#ffff66" stroke-width="2" stroke-dasharray="15,10" opacity="0.6"/>
    `;
    
    // 잔디
    const grass = `
        <!-- 위쪽 잔디 -->
        <polygon points="
            0,0
            ${width},0
            ${width},${isoY(600, -50, 0)}
            ${isoX(600, -50)},${isoY(600, -50, 0)}
            ${isoX(-200, -50)},${isoY(-200, -50, 0)}
            0,${isoY(-200, -50, 0)}
        " fill="#2a4a2a"/>
        
        <!-- 아래쪽 잔디 -->
        <polygon points="
            0,${height}
            ${width},${height}
            ${width},${isoY(600, 120, 0)}
            ${isoX(600, 120)},${isoY(600, 120, 0)}
            ${isoX(-200, 120)},${isoY(-200, 120, 0)}
            0,${isoY(-200, 120, 0)}
        " fill="#1a3a1a"/>
    `;
    
    // 자동차
    const carX = 80;
    const carY = 60;
    const car = `
        <g class="car">
            <polygon points="
                ${isoX(carX, carY)},${isoY(carX, carY, 6)}
                ${isoX(carX + 30, carY)},${isoY(carX + 30, carY, 6)}
                ${isoX(carX + 30, carY + 15)},${isoY(carX + 30, carY + 15, 6)}
                ${isoX(carX, carY + 15)},${isoY(carX, carY + 15, 6)}
            " fill="#1a1a2a"/>
            <polygon points="
                ${isoX(carX + 6, carY + 2)},${isoY(carX + 6, carY + 2, 14)}
                ${isoX(carX + 24, carY + 2)},${isoY(carX + 24, carY + 2, 14)}
                ${isoX(carX + 24, carY + 13)},${isoY(carX + 24, carY + 13, 14)}
                ${isoX(carX + 6, carY + 13)},${isoY(carX + 6, carY + 13, 14)}
            " fill="#2a2a3a"/>
            <ellipse cx="${isoX(carX + 28, carY + 5)}" cy="${isoY(carX + 28, carY + 5, 4)}" rx="2.5" ry="1.5" fill="#ffff99"/>
            <ellipse cx="${isoX(carX + 28, carY + 10)}" cy="${isoY(carX + 28, carY + 10, 4)}" rx="2.5" ry="1.5" fill="#ffff99"/>
            <ellipse cx="${isoX(carX + 2, carY + 5)}" cy="${isoY(carX + 2, carY + 5, 4)}" rx="2" ry="1" fill="#ff4444"/>
            <ellipse cx="${isoX(carX + 2, carY + 10)}" cy="${isoY(carX + 2, carY + 10, 4)}" rx="2" ry="1" fill="#ff4444"/>
        </g>
    `;
    
    // 왼쪽 하단 통계 (도트 폰트)
    const statsLabels = drawDotText('TOTAL: ' + totalContributions, -180, 400, 30, 3, '#ffffff', isoX, isoY);
    const todayLabel = drawDotText('TODAY: ' + todayContributions, -180, 420, 15, 3, '#ffffff', isoX, isoY);
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#08080f"/>
      <stop offset="50%" style="stop-color:#1a1a2a"/>
      <stop offset="100%" style="stop-color:#2a2a3a"/>
    </linearGradient>
    
    <style>
      @keyframes twinkle {
        0%, 100% { opacity: 0.2; }
        50% { opacity: 1; }
      }
      @keyframes windowFlicker {
        0%, 92%, 100% { opacity: 1; }
        95% { opacity: 0.5; }
      }
      @keyframes lampGlow {
        0%, 100% { opacity: 0.4; }
        50% { opacity: 0.6; }
      }
      .star { animation: twinkle 2.5s ease-in-out infinite; }
      .window { animation: windowFlicker 6s ease-in-out infinite; }
      .lamp-glow { animation: lampGlow 2s ease-in-out infinite; }
    </style>
  </defs>
  
  <!-- 배경 -->
  <rect width="${width}" height="${height}" fill="url(#skyGradient)"/>
  
  <!-- 별 -->
  ${stars}
  
  <!-- 달 -->
  <circle cx="800" cy="70" r="40" fill="#ffffee"/>
  <circle cx="792" cy="62" r="6" fill="#eeeedd" opacity="0.4"/>
  <circle cx="810" cy="80" r="4" fill="#eeeedd" opacity="0.3"/>
  
  <!-- 잔디 -->
  ${grass}
  
  <!-- 도로 -->
  ${road}
  
  <!-- 자동차 -->
  ${car}
  
  <!-- 건물 -->
  ${buildings}
  
  <!-- 라벨 -->
  ${labels}
  
  <!-- 타이틀 -->
  ${drawDotText('CONTRIBUTION CITY', -70, -150, 180, 4, '#ffffff', isoX, isoY)}
  
  <!-- 통계 -->
  ${statsLabels}
  ${todayLabel}
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
        
        if (!fs.existsSync('profile-3d-contrib')) {
            fs.mkdirSync('profile-3d-contrib');
        }
        
        fs.writeFileSync('profile-3d-contrib/contribution-city.svg', svg);
        console.log('Generated: profile-3d-contrib/contribution-city.svg');
        
    } catch (error) {
        console.error('Error:', error);
        process.exit(1);
    }
}

main();