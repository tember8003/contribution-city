const https = require('https');
const fs = require('fs');

const GITHUB_TOKEN = process.env.GITHUB_TOKEN;
const USERNAME = process.env.USERNAME;

// GraphQL 쿼리로 contribution 데이터 가져오기
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

// contribution 값에 따른 레벨 계산
function getLevel(count) {
    if (count === 0) return 0;
    if (count <= 3) return 1;
    if (count <= 6) return 2;
    if (count <= 9) return 3;
    return 4;
}

// 건물 색상 팔레트
const buildingColors = {
    0: { front: '#1a3a1a', left: '#153015', right: '#1f451f', roof: '#2a4a2a' }, // 공원
    1: { front: '#5a4a3a', left: '#4a3a2a', right: '#6a5a4a', roof: '#7a6a5a' }, // 주택
    2: { front: '#4a6a8a', left: '#3a5a7a', right: '#5a7a9a', roof: '#6a8aaa' }, // 빌딩
    3: { front: '#6a5a8a', left: '#5a4a7a', right: '#7a6a9a', roof: '#8a7aaa' }, // 고층
    4: { front: '#8a6a4a', left: '#7a5a3a', right: '#9a7a5a', roof: '#aa8a6a' }  // 타워
};

// 최근 7일 데이터 추출
function getLastWeekData(calendar) {
    const allDays = calendar.weeks.flatMap(w => w.contributionDays);
    return allDays.slice(-7);
}

// SVG 생성
function generateSVG(weekData, totalContributions) {
    const width = 800;
    const height = 400;
    
    // 건물 설정
    const buildingWidth = 70;
    const buildingDepth = 35;
    const gap = 12;
    const maxHeight = 160;
    
    // 등각투영 (앞에서 보이게, 살짝 기울임)
    const isoX = (x, z) => 400 + (x * 0.95 + z * 0.3);
    const isoY = (y, x, z) => 230 + (z * 0.25 - y + x * 0.12);
    
    let buildings = '';
    let stars = '';
    
    // 별 생성
    for (let i = 0; i < 50; i++) {
        const x = Math.random() * width;
        const y = Math.random() * 120;
        const r = Math.random() * 1.5 + 0.5;
        const delay = (Math.random() * 3).toFixed(1);
        stars += `<circle class="star" cx="${x}" cy="${y}" r="${r}" fill="white" style="animation-delay: ${delay}s"/>`;
    }
    
    // 요일 이름
    const dayNames = ['Sun', 'Mon', 'Tue', 'Wed', 'Thu', 'Fri', 'Sat'];
    
    // 각 날짜별 건물 생성
    weekData.forEach((day, index) => {
        const level = getLevel(day.contributionCount);
        const colors = buildingColors[level];
        const bHeight = level === 0 ? 10 : Math.max(30, (day.contributionCount / 15) * maxHeight);
        
        const x = (index - 3) * (buildingWidth + gap);
        const z = 0;
        
        if (level === 0) {
            // 공원 (잔디 + 나무)
            const groundPoints = [
                { x: isoX(x, z), y: isoY(0, x, z) },
                { x: isoX(x + buildingWidth, z), y: isoY(0, x + buildingWidth, z) },
                { x: isoX(x + buildingWidth, z + buildingDepth), y: isoY(0, x + buildingWidth, z + buildingDepth) },
                { x: isoX(x, z + buildingDepth), y: isoY(0, x, z + buildingDepth) }
            ];
            
            buildings += `
                <g class="building">
                    <!-- 잔디 -->
                    <polygon points="${groundPoints.map(p => `${p.x},${p.y}`).join(' ')}" fill="${colors.roof}"/>
                    <!-- 나무 -->
                    <polygon points="${isoX(x + 35, z + 17)},${isoY(55, x + 35, z + 17)} ${isoX(x + 20, z + 17)},${isoY(10, x + 20, z + 17)} ${isoX(x + 50, z + 17)},${isoY(10, x + 50, z + 17)}" fill="#2a5a2a"/>
                    <polygon points="${isoX(x + 35, z + 17)},${isoY(75, x + 35, z + 17)} ${isoX(x + 23, z + 17)},${isoY(35, x + 23, z + 17)} ${isoX(x + 47, z + 17)},${isoY(35, x + 47, z + 17)}" fill="#3a6a3a"/>
                    <rect x="${isoX(x + 33, z + 17) - 3}" y="${isoY(10, x + 33, z + 17)}" width="6" height="12" fill="#5a3a2a"/>
                    <!-- 날짜 라벨 -->
                    <text x="${isoX(x + 35, z + 17)}" y="${isoY(-15, x + 35, z + 17)}" text-anchor="middle" fill="#8b949e" font-size="10" font-family="Arial, sans-serif">${dayNames[day.weekday]}</text>
                    <text x="${isoX(x + 35, z + 17)}" y="${isoY(-30, x + 35, z + 17)}" text-anchor="middle" fill="#58a6ff" font-size="12" font-weight="bold" font-family="Arial, sans-serif">${day.contributionCount}</text>
                </g>`;
        } else {
            // 건물 꼭지점
            const p = {
                // 바닥
                fbl: { x: isoX(x, z), y: isoY(0, x, z) },
                fbr: { x: isoX(x + buildingWidth, z), y: isoY(0, x + buildingWidth, z) },
                bbl: { x: isoX(x, z + buildingDepth), y: isoY(0, x, z + buildingDepth) },
                bbr: { x: isoX(x + buildingWidth, z + buildingDepth), y: isoY(0, x + buildingWidth, z + buildingDepth) },
                // 지붕
                ftl: { x: isoX(x, z), y: isoY(bHeight, x, z) },
                ftr: { x: isoX(x + buildingWidth, z), y: isoY(bHeight, x + buildingWidth, z) },
                btl: { x: isoX(x, z + buildingDepth), y: isoY(bHeight, x, z + buildingDepth) },
                btr: { x: isoX(x + buildingWidth, z + buildingDepth), y: isoY(bHeight, x + buildingWidth, z + buildingDepth) }
            };
            
            // 3D 창문 생성
            let windows = '';
            const windowRows = Math.floor(bHeight / 28);
            const windowCols = 3;
            const winWidth = 10;
            const winHeight = 14;
            const winDepth = 2;
            
            for (let row = 0; row < windowRows; row++) {
                for (let col = 0; col < windowCols; col++) {
                    const wy = bHeight - 18 - row * 28;
                    const wx = x + 12 + col * 20;
                    const wz = z - winDepth;
                    
                    const isLit = Math.random() > 0.3;
                    const glowColor = isLit ? '#ffdd66' : '#1a2030';
                    const glowOpacity = isLit ? (0.7 + Math.random() * 0.3).toFixed(2) : '0.8';
                    
                    // 창문 3D 꼭지점
                    const wp = {
                        fbl: { x: isoX(wx, wz), y: isoY(wy, wx, wz) },
                        fbr: { x: isoX(wx + winWidth, wz), y: isoY(wy, wx + winWidth, wz) },
                        ftl: { x: isoX(wx, wz), y: isoY(wy + winHeight, wx, wz) },
                        ftr: { x: isoX(wx + winWidth, wz), y: isoY(wy + winHeight, wx + winWidth, wz) },
                        bbl: { x: isoX(wx, z), y: isoY(wy, wx, z) },
                        bbr: { x: isoX(wx + winWidth, z), y: isoY(wy, wx + winWidth, z) },
                        btl: { x: isoX(wx, z), y: isoY(wy + winHeight, wx, z) },
                        btr: { x: isoX(wx + winWidth, z), y: isoY(wy + winHeight, wx + winWidth, z) }
                    };
                    
                    // 창문 앞면 (밝은 부분)
                    windows += `<polygon class="window" points="${wp.ftl.x},${wp.ftl.y} ${wp.ftr.x},${wp.ftr.y} ${wp.fbr.x},${wp.fbr.y} ${wp.fbl.x},${wp.fbl.y}" fill="${glowColor}" opacity="${glowOpacity}"/>`;
                    
                    // 창문 위쪽 면
                    windows += `<polygon points="${wp.btl.x},${wp.btl.y} ${wp.btr.x},${wp.btr.y} ${wp.ftr.x},${wp.ftr.y} ${wp.ftl.x},${wp.ftl.y}" fill="#2a3040" opacity="0.9"/>`;
                    
                    // 창문 오른쪽 면
                    windows += `<polygon points="${wp.ftr.x},${wp.ftr.y} ${wp.btr.x},${wp.btr.y} ${wp.bbr.x},${wp.bbr.y} ${wp.fbr.x},${wp.fbr.y}" fill="#1a2030" opacity="0.9"/>`;
                }
            }
            
            buildings += `
                <g class="building">
                    <!-- 왼쪽 면 -->
                    <polygon points="${p.bbl.x},${p.bbl.y} ${p.btl.x},${p.btl.y} ${p.ftl.x},${p.ftl.y} ${p.fbl.x},${p.fbl.y}" fill="${colors.left}"/>
                    
                    <!-- 오른쪽 면 -->
                    <polygon points="${p.fbr.x},${p.fbr.y} ${p.ftr.x},${p.ftr.y} ${p.btr.x},${p.btr.y} ${p.bbr.x},${p.bbr.y}" fill="${colors.right}"/>
                    
                    <!-- 앞면 -->
                    <polygon points="${p.fbl.x},${p.fbl.y} ${p.ftl.x},${p.ftl.y} ${p.ftr.x},${p.ftr.y} ${p.fbr.x},${p.fbr.y}" fill="${colors.front}"/>
                    
                    <!-- 지붕 -->
                    <polygon points="${p.ftl.x},${p.ftl.y} ${p.btl.x},${p.btl.y} ${p.btr.x},${p.btr.y} ${p.ftr.x},${p.ftr.y}" fill="${colors.roof}"/>
                    
                    <!-- 3D 창문 -->
                    ${windows}
                    
                    <!-- 날짜 라벨 -->
                    <text x="${isoX(x + 35, z)}" y="${isoY(-15, x + 35, z)}" text-anchor="middle" fill="#8b949e" font-size="10" font-family="Arial, sans-serif">${dayNames[day.weekday]}</text>
                    <text x="${isoX(x + 35, z)}" y="${isoY(-30, x + 35, z)}" text-anchor="middle" fill="#58a6ff" font-size="12" font-weight="bold" font-family="Arial, sans-serif">${day.contributionCount}</text>
                </g>`;
        }
    });
    
    // 통계 계산
    const weekTotal = weekData.reduce((sum, d) => sum + d.contributionCount, 0);
    
    const svg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 ${width} ${height}">
  <defs>
    <linearGradient id="skyGradient" x1="0%" y1="0%" x2="0%" y2="100%">
      <stop offset="0%" style="stop-color:#0a0a20"/>
      <stop offset="100%" style="stop-color:#1a1a40"/>
    </linearGradient>
    <style>
      @keyframes twinkle {
        0%, 100% { opacity: 0.3; }
        50% { opacity: 1; }
      }
      @keyframes float {
        0%, 100% { transform: translateY(0); }
        50% { transform: translateY(-2px); }
      }
      @keyframes windowFlicker {
        0%, 85%, 100% { opacity: 1; }
        90% { opacity: 0.6; }
      }
      .star { animation: twinkle 2s ease-in-out infinite; }
      .building { animation: float 4s ease-in-out infinite; }
      .building:nth-child(odd) { animation-delay: 0.5s; }
      .window { animation: windowFlicker 4s ease-in-out infinite; }
    </style>
  </defs>
  
  <!-- 배경 -->
  <rect width="${width}" height="${height}" fill="url(#skyGradient)"/>
  
  <!-- 별 -->
  ${stars}
  
  <!-- 달 -->
  <circle cx="700" cy="50" r="20" fill="#ffffee" opacity="0.9"/>
  <circle cx="707" cy="46" r="20" fill="url(#skyGradient)"/>
  
  <!-- 땅 -->
  <polygon points="0,330 ${width},330 ${width},${height} 0,${height}" fill="#1a1a2e"/>
  <polygon points="0,330 400,300 ${width},330" fill="#252540"/>
  
  <!-- 건물들 -->
  ${buildings}
  
  <!-- 타이틀 -->
  <text x="400" y="30" text-anchor="middle" fill="white" font-family="Arial, sans-serif" font-size="18" font-weight="bold">
    🏙️ ${USERNAME}'s Contribution City
  </text>
  
  <!-- 통계 -->
  <text x="400" y="${height - 15}" text-anchor="middle" fill="#8b949e" font-family="Arial, sans-serif" font-size="12">
    This Week: ${weekTotal} contributions | Total: ${totalContributions} contributions
  </text>
</svg>`;

    return svg;
}

// 메인 실행
async function main() {
    try {
        console.log(`Fetching contributions for ${USERNAME}...`);
        const calendar = await fetchContributions();
        
        console.log(`Total contributions: ${calendar.totalContributions}`);
        
        const weekData = getLastWeekData(calendar);
        console.log('Last 7 days:', weekData.map(d => `${d.date}: ${d.contributionCount}`).join(', '));
        
        const svg = generateSVG(weekData, calendar.totalContributions);
        
        // 출력 디렉토리 생성
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