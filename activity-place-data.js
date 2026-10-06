(function () {
  'use strict';

  // Research candidates only. None of these records guarantees current opening,
  // admission, route access, available seats, or weather conditions.
  const checked = '2026-10-05';
  const place = (id, title, region, area, activities, desc, sourceUrl, extra = {}) => ({
    id: `research-${id}`,
    title,
    venueTitle: null,
    region,
    area,
    activities,
    desc,
    sourceUrl,
    sourceCheckedAt: checked,
    availableFrom: null,
    availableUntil: null,
    admissionNote: '당일 이용 가능 여부는 확인되지 않았어요.',
    auditStatus: 'candidate',
    lat: null,
    lng: null,
    ...extra,
  });

  const exhibit = (id, title, venueTitle, region, area, desc, sourceUrl, from, until, admissionNote, auditStatus = 'candidate') =>
    place(id, title, region, area, ['exhibit'], desc, sourceUrl, {
      venueTitle,
      availableFrom: from,
      availableUntil: until,
      admissionNote,
      auditStatus,
    });

  window.ACTIVITY_PLACE_DATA = [
    // Walking: official route/attraction pages; access and weather still require a fresh check.
    place('walk-seoul-trail-15', '서울둘레길 15코스', '서울', '가양대교 남단~증산역', ['walk'], '가양대교 남단부터 증산역까지 약 7.7km 걷기 코스.', 'https://gil.seoul.go.kr/gil/view.do?key=2407100006&sc_gilNo=15'),
    place('walk-jingyeongsansuhwa', '진경산수화길', '서울', '서울 테마산책길', ['walk'], '약 3km 테마 산책길 걷기.', 'https://gil.seoul.go.kr/trail/view.do?key=2405200008&sc_trailSeCd=SE002&sc_trailSn=173'),
    place('walk-amsa-ecology', '암사 생태산책길', '서울', '한강공원 암사 일대', ['walk'], '한강공원 생태산책길 걷기.', 'https://hangang.seoul.go.kr/www/bbsPost/14/list.do?mid=721'),
    place('walk-cheongcho-lake', '청초호', '강원', '속초', ['walk'], '호수 둘레 약 5km 산책.', 'https://www.gangwon.to/gwtour/only/attraction?articleSeq=307'),
    place('walk-yeongrang-lake', '영랑호', '강원', '속초', ['walk'], '호수 주변 길 산책.', 'https://www.gangwon.to/gwtour/information/news?articleSeq=60898'),
    place('walk-sejo-trail', '세조길', '충북', '보은 속리산', ['walk'], '법주사 삼거리부터 복천암 방향으로 걷기.', 'https://tour.chungbuk.go.kr/www/contents.do?key=256', { admissionNote: '국립공원·법주사 구간의 입장 및 탐방 조건을 확인해 주세요.', auditStatus: 'hold' }),
    place('walk-pureun-gil', '푸른길공원', '광주', '동구·남구', ['walk'], '폐선부지 공원길 약 5km 걷기.', 'https://tour.gwangju.go.kr/cms/board/B0005.cs?act=read&articleId=3967&pageIndex=1', { auditStatus: 'hold', admissionNote: '공식 소개가 오래되어 현재 길 상태를 재확인해야 해요.' }),
    place('walk-jeonju-hidden', '한옥마을 숨길', '전북', '전주 한옥마을', ['walk'], '한옥마을 도보 코스 약 2.2km 걷기.', 'https://tour.jeonju.go.kr/images/file/map/05_mapWalking.pdf'),
    place('walk-samrak', '삼락생태공원', '부산', '사상구', ['walk'], '철새먹이터 순환 산책로 약 1.5km 걷기.', 'https://www.busan.go.kr/nakdong/samrakpark03'),
    place('walk-jeoryeong', '절영해안산책로', '부산', '영도구', ['walk'], '해안 산책로 약 3km 걷기.', 'https://www.busan.go.kr/geopark/taejongdae'),
    place('walk-green-railway', '그린레일웨이', '부산', '해운대구', ['walk'], '옛 해안 철길을 따라 약 4.8km 걷기.', 'https://www.visitbusan.net/kr/index.do?lang_cd=ko&menuCd=DOM_000000202002001000&uc_seq=1326'),
    place('walk-dongchuksan', '동축산', '울산', '동구', ['walk'], '신전체육공원과 동축산 사이 산길 왕복 약 3.6km 걷기.', 'https://www.ulsan.go.kr/tour/kor/unit/attrctn/view.do?mId=001002001000000000&unqId=157'),
    place('walk-seongan-olle', '제주 성안올레 1코스', '제주', '제주시 원도심', ['walk'], '산지천·탑동광장·용연구름다리 등을 지나는 약 6km 걷기.', 'https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_300000000012898&menuId=DOM_000001718008000000'),
    place('walk-songaksan-olle', '송악산', '제주', '서귀포 사계리', ['walk'], '사계포구에서 송악산 주차장까지 약 3.2km 올레길 걷기.', 'https://www.visitjeju.net/cn/detail/view?contentsid=CNTS_000000000018792', { admissionNote: '올레 구간 우회·변경 여부를 확인해 주세요.', auditStatus: 'hold' }),
    place('walk-gimnyeong-seongsegi', '제주올레 20코스', '제주', '김녕~성세기 해변', ['walk'], '제주올레 20코스의 김녕~성세기 해변 약 1.6km 구간 걷기.', 'https://www.visitjeju.net/kr/detail/view?contentsid=CNTS_000000000020313&menuId=DOM_000002016010000000', { admissionNote: '전체 코스가 아닌 일부 구간이며 우회·변경 여부를 확인해 주세요.', auditStatus: 'hold' }),

    // Running: route and track evidence have different strength. Event-only routes are held.
    place('run-jamwon-riverside', '잠원한강공원', '서울', '서초구 강변길', ['run'], '반포대교부터 한남대교 방향으로 약 5km 달리기.', 'https://sports.seoul.go.kr/main/board/10/6917/board_view.do'),
    place('run-seokchon-lake', '석촌호수', '서울', '송파구', ['run'], '호수 산책길을 따라 달리기.', 'https://sports.seoul.go.kr/main/board/10/6917/board_view.do'),
    place('run-yeouido-park', '여의도공원', '서울', '영등포구', ['run'], '공원 둘레 약 2.5km 행사 코스로 소개된 길 달리기.', 'https://hangang.seoul.go.kr/www/eventMng/detail.do?evntSn=174&mid=538&pageNo=1&srchType=list', { auditStatus: 'hold', admissionNote: '행사 코스만 확인되어 평상시 개인 러닝 조건은 미확인입니다.' }),
    place('run-yunjung-ro', '여의도 윤중로', '서울', '영등포구', ['run'], '행사 코스로 제시된 윤중로 구간 달리기.', 'https://hangang.seoul.go.kr/www/eventMng/detail.do?evntSn=174&mid=538&pageNo=1&srchType=list', { auditStatus: 'hold', admissionNote: '행사·차량 통제와 평상시 개인 이용 조건을 확인해야 해요.' }),
    place('run-expo-square', '엑스포시민광장', '대전', '유성구', ['run'], '광장 순환 약 1km 또는 엑스포다리 연계 약 2km 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1'),
    place('run-gapcheon', '갑천', '대전', '엑스포다리~KAIST', ['run'], '엑스포다리부터 KAIST 방향 약 5km 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1'),
    place('run-yudeungcheon', '유등천', '대전', '파라곤아파트~용문교', ['run'], '하천변 약 5km 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1'),
    place('run-daejeoncheon', '대전천', '대전', '목척교~현암교', ['run'], '하천변 약 3km 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1'),
    place('run-lohas-happyroad', '금강 로하스 해피로드', '대전', '대덕구', ['run'], '대청공원에서 미호교 방향 약 5km 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1'),
    place('run-gapcheon-lake', '갑천생태호수공원', '대전', '유성구', ['run'], '호수 둘레 약 3.5~4km 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1'),
    place('run-jeonjucheon', '전주천', '전북', '전주', ['run'], '하천변에서 달리기.', 'https://tour.jeonju.go.kr/board/view.jeonju?boardId=BBS_0000003&contentsSid=1&dataSid=9774&paging=ok&startPage=1'),
    place('run-daewangam', '대왕암공원 둘레길', '울산', '동구', ['run'], '바닷가길 약 2.3km 슬로 러닝.', 'https://webzine.ulsan.go.kr/contents/view.do?bbsId=BBSMSTR_000000000180&nttId=15452'),
    place('run-ulsan-forest', '울산숲', '울산', '북구', ['run'], '이화정 또는 송정 구간 숲길 슬로 러닝.', 'https://webzine.ulsan.go.kr/contents/view.do?bbsId=BBSMSTR_000000000180&nttId=15452'),
    place('run-jeju-oldtown', '제주 원도심', '제주', '제주시 산지천·탑동·제주항 일대', ['run'], '과거 행사에서 산지천~탑동~용두암 5.6km와 산지천~제주항 6.5km 코스를 제시.', 'https://www.visitjeju.net/korean/Bd/view.php?bno=2215&btable=report_info&cate=0&p=36', { auditStatus: 'hold', admissionNote: '과거 행사 코스일 뿐이며 항만 접근·평상시 개인 이용은 확인되지 않았어요.' }),
    place('run-daegu-sincheon', '신천', '대구', '신천변', ['run'], '신천변 산책로에서 달리기. 특정 러닝 거리 미확인.', 'https://tour.daegu.go.kr/index.do?menu_id=00002943&menu_link=%2Ffront%2Ftour%2FtourMapsView.do%3FtourId%3DKOATTR_258', { auditStatus: 'hold', admissionNote: '관광 안내는 산책로를 확인했지만 러닝 루프·동선은 미확인입니다.' }),
    place('run-gongjicheon', '공지천 호수공원', '강원', '춘천', ['run'], '의암호변 수변 산책로에서 슬로 러닝.', 'https://www.chuncheon.go.kr/tour/destination/ai-tour/tour-news/?bbsId=BBSMSTR_000000000742&flag=view&nttId=1028'),
    place('run-apec-naru', 'APEC나루공원', '부산', '수영강변', ['run'], '부산시 러닝크루가 집결하는 수영강변에서 달리기.', 'https://www.busan.go.kr/nbnews/1731575?srchBeginDt=2025-05-22&srchEndDt=2026-05-22', { auditStatus: 'hold', admissionNote: '신청형 크루 집결지 근거이며 일반 달리기 동선·개방은 미확인입니다.' }),
    place('run-jamwon-track', '잠원한강공원 육상연습장', '서울', '서초구', ['run'], '환형 마사토 트랙에서 달리기.', 'https://hangang.seoul.go.kr/www/contents/777.do?mid=516', { admissionNote: '공식 안내상 무료·항시개방. 현장 정비와 행사 여부는 확인해 주세요.' }),
    place('run-yeouido-track', '여의롤장 러닝트랙', '서울', '영등포구 여의도한강공원', ['run'], '러닝트랙에서 달리기.', 'https://hangang.seoul.go.kr/www/contents/777.do?mid=516', { admissionNote: '공식 안내상 무료·항시개방. 현장 통제 여부는 확인해 주세요.' }),
    place('run-banpo', '반포한강공원', '서울', '서초구', ['run'], '공식 안내에서 조깅을 소개한 한강공원 산책로 달리기.', 'https://hangang.seoul.go.kr/www/contents/663.do?mid=463'),
    place('run-yeouido-riverside', '여의도한강공원', '서울', '영등포구', ['run'], '공원 강변길 달리기. 정확한 출발·종점 미확인.', 'https://hangang.seoul.go.kr/www/contents/669.do?lt=&mid=473', { auditStatus: 'hold' }),
    place('run-ttukseom', '뚝섬한강공원', '서울', '광진구', ['run'], '한강공원 강변길 달리기 후보. 공식 페이지에 러닝 코스는 명시되지 않음.', 'https://hangang.seoul.go.kr/www/contents/654.do?mid=449&tr_code=sweb&tr_code=tcontents', { auditStatus: 'hold' }),
    place('run-jamsil-riverside', '잠실한강공원', '서울', '송파구', ['run'], '한강공원 강변길 달리기 후보. 정확한 러닝 루프 미확인.', 'https://hangang.seoul.go.kr/www/contents/651.do?mid=444', { auditStatus: 'hold' }),
    place('run-mangwon', '망원한강공원', '서울', '마포구', ['run'], '한강공원 강변길 달리기 후보. 정확한 러닝 루프 미확인.', 'https://hangang.seoul.go.kr/www/contents/666.do?mid=468&tr_code=sweb', { auditStatus: 'hold' }),
    place('run-cheonggye', '청계천', '서울', '종로구~중구', ['run'], '과거 러닝크루 종묘~청계천 행사 코스.', 'https://sports.seoul.go.kr/main/SP04100000_user/program_view.do', { auditStatus: 'hold', admissionNote: '행사 외 일반 러닝 조건과 수해·통제 여부를 확인해야 해요.' }),
    place('run-bucheon-upper', '부천종합운동장 2층 외부 트랙', '경기', '부천', ['run'], '시민 상시 개방 트랙에서 달리기.', 'https://news.bucheon.go.kr/home/kor/M814028754/reporter/citizen/edit.do?idx=cb00d1a0008a85e71a41b8741facbffed13312853f4887994e2e471814066aff', { admissionNote: '공식 안내상 시민 상시 개방. 행사·정비 여부는 확인해 주세요.' }),
    place('run-bucheon-stadium', '부천종합운동장 1층 주경기장 육상트랙', '경기', '부천', ['run'], '시민 개방 시간에 육상트랙 달리기.', 'https://news.bucheon.go.kr/home/kor/M814028754/reporter/citizen/edit.do?idx=cb00d1a0008a85e71a41b8741facbffed13312853f4887994e2e471814066aff', { admissionNote: '공식 안내상 무료, 06:00–08:00·18:00–20:00. 경기·점검 통제 확인 필요.' }),
    place('run-gudeok-stadium', '구덕운동장 주경기장 트랙', '부산', '서구', ['run'], '시민 조깅·걷기 개방 시간에 트랙 달리기.', 'https://www.busan.go.kr/stadium/sfopen', { auditStatus: 'hold', admissionNote: '공식 개방시간은 05:00–09:00·17:30–22:00이나 2026년 10월 제한 공지가 있어 날짜별 확인 필요.' }),
    place('run-asiad', '아시아드 보조경기장 트랙', '부산', '연제구', ['run'], '시민 조깅 개방 안내가 있는 보조경기장 트랙.', 'https://www.busan.go.kr/stadium/sfopen', { auditStatus: 'hold', admissionNote: '2026년 10월 이용 중지 공지 있음. 재개 확인 전 추천 불가.' }),
    place('run-kaist', 'KAIST 본원 동쪽 대운동장', '대전', '유성구', ['run'], '공식 관광 자료의 시민 개방 400m 트랙에서 달리기.', 'https://daejeon.go.kr/its/ItsdjNormalboardView.do?boardGubun=itsdj01&boardSeq=3721&menuSeq=5931&pageIndex=1', { auditStatus: 'hold', admissionNote: '학교 운영기관의 최신 개방 시간·대관 일정 미확인.' }),

    // Cafes: keep the actual branch names; seating and today's business remain unverified.
    place('cafe-terarosa-cheonggye', '테라로사 청계광장점', '서울', '중구 청계광장', ['cafe'], '청계천 근처 카페에서 커피 마시며 쉬기.', 'https://renew.terarosa.com/store/list', { admissionNote: '공식 매장 시간 확인. 당일 영업·좌석·대기 미확인.' }),
    place('cafe-bluebottle-yeonnam', '블루보틀 연남 카페', '서울', '마포구 연남동', ['cafe'], '연남동 카페에서 쉬기.', 'https://kr.bluebottlecoffee.com/blogs/locator/bluebottle-yeonnam-cafe'),
    place('cafe-terarosa-seojong', '테라로사 서종점', '경기', '양평 서종면', ['cafe'], '북한강 인근 카페에서 쉬기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-terarosa-dongtan', '테라로사 동탄호수점', '경기', '화성 동탄', ['cafe'], '동탄호수 주변 카페에서 쉬기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-terarosa-gyeongpo', '테라로사 경포호수점', '강원', '강릉 경포호', ['cafe'], '호수 산책 후 카페에서 쉬기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-terarosa-sacheon', '테라로사 사천해변점', '강원', '강릉 사천해변', ['cafe'], '바다를 본 뒤 카페에서 쉬기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-paulbassett-bangseo', '폴 바셋 청주 방서 DT점', '충북', '청주 방서동', ['cafe'], '시내 카페에서 잠시 쉬기. 실내 좌석은 미확인.', 'https://www.baristapaulbassett.co.kr/store/StoreView.pb?shopSeq=2000182001'),
    place('cafe-terarosa-sejong', '테라로사 세종점', '세종', '세종시', ['cafe'], '도심 카페에서 쉬기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-paulbassett-daejeon-outlet', '폴 바셋 현대아울렛 대전점', '대전', '유성구 현대아울렛', ['cafe'], '아울렛 내 카페에서 쉬기.', 'https://www.baristapaulbassett.co.kr/store/StoreView.pb?shopSeq=2000148001', { admissionNote: '아울렛 정기휴무에 매장도 영향을 받을 수 있어요.' }),
    place('cafe-paulbassett-jeonju-geumam', '폴 바셋 전주 금암 DT점', '전북', '전주 금암동', ['cafe'], '카페에서 커피를 마시며 쉬기.', 'https://www.baristapaulbassett.co.kr/store/StoreView.pb?shopSeq=2000156001'),
    place('cafe-paulbassett-gwangju-suwan', '폴 바셋 롯데아울렛 광주수완점', '광주', '광산구 롯데아울렛', ['cafe'], '아울렛 내 카페에서 쉬기.', 'https://www.baristapaulbassett.co.kr/whatsNews/event/View.pb?eventSeq=497', { auditStatus: 'hold', admissionNote: '개점 당시 공지로 현재 매장·운영시간 재검증 필요.' }),
    place('cafe-terarosa-gyeongju', '테라로사 경주점', '경북', '경주', ['cafe'], '경주 관광 뒤 카페에서 쉬기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-terarosa-postech', '테라로사 포스텍점', '경북', '포항 포스텍', ['cafe'], '캠퍼스 인근 카페에서 쉬기.', 'https://renew.terarosa.com/store/list', { auditStatus: 'hold', admissionNote: '캠퍼스 건물 출입 및 좌석 이용 조건 미확인.' }),
    place('cafe-terarosa-suyeong', '테라로사 수영점', '부산', '수영구', ['cafe'], '복합문화공간 근처 카페에서 커피 마시기.', 'https://renew.terarosa.com/store/list'),
    place('cafe-bluebottle-minrak', '블루보틀 부산 민락 카페', '부산', '수영구 민락동', ['cafe'], '바다 근처 카페에서 쉬기. 공식 안내상 3·4층 운영.', 'https://kr.bluebottlecoffee.com/pages/cafe-list'),
    place('cafe-terarosa-seogwipo', '테라로사 서귀포점', '제주', '서귀포', ['cafe'], '제주 남부 카페에서 커피와 휴식.', 'https://renew.terarosa.com/store/list'),

    // Facility-level permanent exhibitions only where no dated exhibit for the same venue is below.
    place('exhibit-folk-permanent', '국립민속박물관 본관', '서울', '종로구', ['exhibit'], '현재 개방된 민속 상설전시관 관람.', 'https://www.nfm.go.kr/home/subIndex/1239.do', { venueTitle: '국립민속박물관 본관', admissionNote: '개인 사전예약 불필요·무료. 상설전시관1 휴관 범위와 당일 공지 확인.' }),
    place('exhibit-anyang-permanent', '안양박물관', '경기', '안양', ['exhibit'], '안양박물관 상설전시 관람.', 'https://m.ayac.or.kr/museum/contents/view?contentsNo=50&menuLevel=2&menuNo=44', { venueTitle: '안양박물관', admissionNote: '매주 월요일 휴관. 10/5 오늘 추천 제외; 방문 날짜와 개방 전시실 재확인 필요.', auditStatus: 'hold' }),
    place('exhibit-gyeongju-permanent', '국립경주박물관', '경북', '경주', ['exhibit'], '신라 역사 상설전시 관람.', 'https://gyeongju.museum.go.kr/kor/html/sub01/0101.html', { venueTitle: '국립경주박물관', admissionNote: '일반전시 무료. 일부 상설관 분기 휴관·개인 예약 여부 확인 필요.' }),
    exhibit('exhibit-nmk-table', '우리들의 밥상', '국립중앙박물관', '서울', '용산구', '우리의 삶과 자연이 담긴 밥상의 의미를 다루는 특별전 관람.', 'https://www.museum.go.kr/MUSEUM/contents/M0202010000.do?exhiSpThemId=3529713&listType=list&menuId=specialGallery&schM=view', '2026-07-01', '2026-10-25', '25~64세 5,000원, 7~24세 3,000원. 당일 현장 입장권 구매 가능 명시; 재고·매진 미확인.'),
    exhibit('exhibit-mmca-suh', '서도호', '국립현대미술관 서울', '서울', '종로구', '서도호의 설치미술 개인전 관람.', 'https://www.mmca.go.kr/exhibitions/exhibitionsDetail.do?exhFlag=2&exhId=202601200002041', '2026-08-27', '2027-02-09', '8,000원. 온라인 예약 채널 있음; 현장 발권 가능 여부 미확인.', 'hold'),
    exhibit('exhibit-mmca-artist-2026', '올해의 작가상 2026', '국립현대미술관 서울', '서울', '종로구', '선정 작가 4인의 현대미술 전시 관람.', 'https://mmca.go.kr/exhibitions/exhibitionsDetail.do?exhId=202512310002018', '2026-07-24', '2026-12-06', '2,000원. 온라인 예약 채널 있음; 현장 발권 가능 여부 미확인.', 'hold'),
    exhibit('exhibit-sema-yoo', '유영국: 산은 내 안에 있다', '서울시립미술관 서소문본관', '서울', '중구', '유영국 회고전 관람.', 'https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1529410', '2026-05-19', '2026-10-25', '무료. 사전예약 링크가 있으나 필수 여부·현장 입장 미확인.', 'hold'),
    exhibit('exhibit-sema-kim', '김희천: 두더지들', '서울시립 서서울미술관', '서울', '금천구', '김희천의 영상·게임·사진 설치 전시 관람.', 'https://sema.seoul.go.kr/kr/whatson/exhibition/detail?exNo=1565012', '2026-08-20', '2026-11-08', '무료. 사전예약 링크가 있으나 필수 여부·현장 입장 미확인.', 'hold'),
    exhibit('exhibit-chuncheon-patriot-art', '제16회 대한민국 호국미술대전', '국립춘천박물관', '강원', '춘천', '어린이박물관 2층 열린전시실의 호국미술대전 관람.', 'https://chuncheon.museum.go.kr/prog/openExht/kor/sub02_03/view.do?openExhtId=OPENEXHT_00000000079', '2026-09-30', '2026-10-11', '요금 별도 미기재. 성인 단독 접근·예약 여부 미확인.', 'hold'),
    exhibit('exhibit-daejeon-lim', '제23회 이동훈미술상 본상 수상작가전: 임송자', '대전시립미술관', '대전', '서구', '임송자의 인체 조각 전시 관람.', 'https://daejeon.go.kr/dma/DmaExhibList.do?exType=04&menuSeq=6086', '2026-10-01', '2026-11-22', '요금·개인 현장 입장·예약 여부 미확인.', 'hold'),
    exhibit('exhibit-daejeon-grass', '풀의 시간', '대전시립미술관 열린수장고', '대전', '서구', '열린수장고 소장품 기획전 관람.', 'https://daejeon.go.kr/dma/DmaExhibList.do?exType=04&menuSeq=6086', '2026-09-08', '2026-12-20', '열린수장고 일반 무료 안내. 전시별 요금·현장 입장 조건 재확인.', 'hold'),
    exhibit('exhibit-gwangju-earthenware', 'Earthen Vessels: Stories of Our Lives', '국립광주박물관', '광주', '북구', '생활 속 도기의 전통과 미감을 다루는 특별전 관람.', 'https://gwangju.museum.go.kr/prog/specialDisplay/eng/sub02_02/s/normal/list.do', '2026-07-29', '2026-10-25', '요금·현장 입장·예약 여부 미확인.', 'hold'),
    exhibit('exhibit-jeonju-arhats', '도량으로의 귀환, 전주 서고사 나한', '국립전주박물관', '전북', '전주', '전주 서고사 나한 특별전 관람.', 'https://jeonju.museum.go.kr/special.es?act=view&mid=a10201010000&seq=1711', '2026-09-16', '2026-11-29', '무료. 개인 현장 입장·예약 여부 미확인.'),
    exhibit('exhibit-jeonju-architecture', '짓고 쓰다 – 건축과 기록', '국립전주박물관', '전북', '전주', '건축과 기록을 다룬 상설전시관 테마전 관람.', 'https://jeonju.museum.go.kr/special.es?act=view&mid=a10201010000&seq=1713', '2026-09-08', '2026-12-07', '요금·현장 입장·예약 여부 미확인.', 'hold'),
    exhibit('exhibit-busan-port', '개항, 부산항 150년', '국립해양박물관', '부산', '영도구', '부산항 개항 150년의 변화와 기록을 다룬 기획전 관람.', 'https://www.mmk.or.kr/?cate=now&folder=exhibition&idx=89&page=view', '2026-06-30', '2026-10-11', '무료. 시설 FAQ는 개인 사전예약 없이 자유 관람을 명시.'),
    exhibit('exhibit-busan-objects', '사물의 이동', '국립해양박물관', '부산', '영도구', '국립해양박물관 기획전시실 2의 협력 전시 관람.', 'https://www.mmk.or.kr/?cate=now&folder=exhibition&page=list', '2026-10-01', '2026-11-07', '무료. 시설 일반 개인 무예약 안내는 있으나 전시 별도 제한 여부 미확인.'),
    exhibit('exhibit-jeju-moment', '찰나의 영원, 제주를 담다', '국립제주박물관', '제주', '제주시', '김영갑 작가 기증 사진전 관람.', 'https://jeju.museum.go.kr/html/kr/', '2026-06-16', '2027-03-01', '특별전 요금·개인 현장 입장·예약 여부 미확인.', 'hold'),

    // Reading: on-site reading candidates, not guaranteed seats or non-member lending.
    place('read-seoul-library', '서울도서관', '서울', '중구', ['read'], '일반자료실에서 책 읽기.', 'https://lib.seoul.go.kr/', { admissionNote: '무료 공공도서관. 좌석·회원 조건·공휴일 휴관 확인 필요.' }),
    place('read-gwanggyo-hongjae', '광교홍재도서관', '경기', '수원', ['read'], '종합자료실에서 책 읽기.', 'https://www.suwonlib.go.kr/gh/html/01_guide/guide01.asp'),
    place('read-suwon-central', '수원중앙도서관', '경기', '수원', ['read'], '종합자료실에서 책 읽기.', 'https://www.suwonlib.go.kr/ct/html/01_guide/guide01.asp'),
    place('read-chuncheon', '춘천시립도서관', '강원', '춘천', ['read'], '제1·2자료실의 독서 좌석에서 책 읽기.', 'https://library.chuncheon.go.kr/library-useinfo/library-info/municipal/facility-info', { admissionNote: '무료 공공도서관. 공식 시설안내에 독서 좌석 명시; 당일 좌석·휴관 확인 필요.' }),
    place('read-hanbat', '한밭도서관', '대전', '중구', ['read'], '일반자료실에서 책 읽기.', 'https://daejeon.go.kr/hanbatlibrary/contentsHtmlView.do?menuSeq=6183'),
    place('read-gwangju-central', '광주광역시교육청 중앙도서관', '광주', '동구', ['read'], '종합자료실에서 책 읽기.', 'https://lib.jge.go.kr/jungang/contents.do?idx=2254', { auditStatus: 'hold', admissionNote: '주말 운영·정기휴관·좌석 방식 미확인.' }),
    place('read-jeonju-kkotsim', '전주시립도서관 꽃심', '전북', '전주', ['read'], '종합자료실에서 책 읽기.', 'https://tour.jeonju.go.kr/images/visitjj/contents/img_book_map.pdf', { auditStatus: 'hold', admissionNote: '운영시간 근거가 오래되어 현재 자료실 운영 재검증 필요.' }),
    place('read-busan-library', '부산도서관', '부산', '사상구', ['read'], '자료실에서 책 읽기.', 'https://library.busan.go.kr/busanlibrary/html.do?menu_idx=97'),
    place('read-daegu-gukbo', '국채보상운동기념도서관', '대구', '중구', ['read'], '종합자료실 또는 인문자료실에서 책 읽기.', 'https://library.daegu.go.kr/gukbo/index.do'),
    place('read-jeju-library', '제주도서관', '제주', '제주시', ['read'], '본관 자료실에서 책 읽기.', 'https://org.jje.go.kr/lib/index.jje', { auditStatus: 'hold', admissionNote: '주말 시간·휴관·좌석 방식 미확인.' }),
  ];
  // QA: do not infer a substitute-public-holiday exception from weekday hours.
  const holidayHolds = {
    'research-read-seoul-library': '월요일·공휴일 휴관. 10/5 추천 제외; 방문일 자료실 개방 재확인 필요.',
    'research-exhibit-busan-port': '월요일 휴관 안내가 있으나 10/5 대체공휴일 예외 미확인. 방문일 개관 확인 전 보류.',
    'research-exhibit-busan-objects': '월요일 휴관 안내가 있으나 10/5 대체공휴일 예외 미확인. 방문일 개관 확인 전 보류.',
    'research-read-busan-library': '매주 월요일·법정공휴일 휴관. 10/5 추천 제외; 방문일 자료실 개방 재확인 필요.',
    'research-exhibit-anyang-permanent': '월요일 휴관 및 공휴일 운영 안내를 방문일 기준으로 재확인하기 전 보류.',
    'research-read-gwanggyo-hongjae': '자료실은 법정공휴일 휴관. 10/5 제외; 방문일 개방 재확인 전 보류.',
    'research-read-suwon-central': '법정공휴일 휴관 및 최근 임시휴관 공지가 있어 자료실 재개 확인 전 보류.',
    'research-read-daegu-gukbo': '첫째·셋째 월요일과 관공서 공휴일 휴관. 10/5 제외; 방문일 개방 재확인 전 보류.',
    'research-read-chuncheon': '관공서 공휴일 휴관. 10/5 제외; 방문일 개방 재확인 전 보류.',
    'research-read-hanbat': '공휴일 월요일의 열람실 개방과 자료실 휴관 규칙이 달라 책 이용 범위 재확인 전 보류.',
  };
  for (const spot of window.ACTIVITY_PLACE_DATA) {
    if (holidayHolds[spot.id]) Object.assign(spot, { auditStatus: 'hold', admissionNote: holidayHolds[spot.id] });
  }
  // Official holiday exception: open Monday 10/5, closed next weekday 10/6.
  for (const id of ['research-exhibit-busan-port', 'research-exhibit-busan-objects']) {
    const spot = window.ACTIVITY_PLACE_DATA.find((item) => item.id === id);
    Object.assign(spot, { auditStatus: 'candidate', closedWeekdays: [1], openDates: ['2026-10-05'], closedDates: ['2026-10-06'],
      admissionNote: '무료, 일반 개인 사전예약 없이 관람. 공휴일 월요일에는 개관하고 다음 첫 평일 휴관: 10/5 개관 규칙, 10/6 휴관. 전시실 제한·당일 공지는 공식 홈페이지 확인.' });
  }
})();
