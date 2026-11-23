/**
 * 基于《18_球员姓名库.json》v2.1 的纯 TS 姓名与球队名称生成器
 * 覆盖全国 34 个省级行政区及主要地级市，拓展俱乐部主题词缀与后缀库
 * 零外部 JSON/fs 依赖，可直接打包至 Steam 与微信小游戏
 */

const SURNAMES_RAW = [
  '王', '李', '张', '刘', '陈', '杨', '赵', '黄', '周', '吴',
  '徐', '孙', '胡', '朱', '高', '林', '何', '郭', '马', '罗',
  '梁', '宋', '郑', '谢', '韩', '唐', '冯', '于', '董', '萧',
  '程', '曹', '袁', '邓', '许', '傅', '沈', '曾', '彭', '吕',
  '苏', '卢', '蒋', '蔡', '贾', '丁', '魏', '薛', '叶', '阎',
  '余', '潘', '杜', '戴', '夏', '钟', '汪', '田', '任', '姜',
  '范', '方', '石', '姚', '谭', '廖', '邹', '熊', '金', '陆',
  '郝', '孔', '白', '崔', '康', '毛', '邱', '秦', '江', '史',
  '顾', '侯', '邵', '孟', '龙', '万', '段', '钱', '汤', '尹',
  '黎', '易', '常', '武', '乔', '贺', '赖', '龚', '文', '庞',
  '樊', '兰', '殷', '施', '陶', '洪', '温', '安', '牛', '岳',
  '翟', '严', '霍', '管', '莫', '涂', '俞', '焦', '肖', '伍',
  '裴', '左', '欧', '雷', '鲍', '祝', '柳', '符', '舒', '路',
  '童', '梅', '盛', '季', '骆', '娄', '向', '邢', '晏', '齐',
  '申', '葛', '翁', '荀', '苗', '柴', '邬', '耿', '卜', '牟',
  '章', '颜', '宁', '裘', '阮', '沙', '桂', '甘', '辛', '司',
  '燕', '覃', '欧阳', '司马', '上官', '诸葛', '东方', '皇甫',
  '尉迟', '公孙', '令狐', '宇文', '慕容', '司徒', '南宫', '夏侯',
];

const MALE_CHARS_RAW = [
  '伟', '强', '磊', '军', '勇', '杰', '涛', '明', '超', '华',
  '刚', '辉', '鹏', '斌', '波', '宇', '浩', '凯', '健', '俊',
  '帅', '飞', '亮', '威', '龙', '翔', '林', '峰', '毅', '昊',
  '阳', '东', '志', '平', '建', '国', '文', '博', '晨', '旭',
  '海', '天', '星', '雨', '风', '云', '雷', '电', '雪', '川',
  '山', '河', '江', '洋', '岭', '岩', '石', '松', '柏', '杨',
  '柳', '枫', '森', '金', '铁', '钢', '锋', '剑', '虎', '豹',
  '狮', '鹰', '鹤', '智', '聪', '睿', '哲', '德', '仁', '义',
  '信', '诚', '正', '安', '康', '宁', '顺', '和', '祥', '瑞',
  '成', '功', '胜', '利', '荣', '兴', '英', '雄', '豪', '贤',
  '良', '轩', '逸', '然', '恒', '泽', '铭', '渊', '航', '远',
  '达', '通', '迅', '捷', '坤', '乾', '震', '元', '彬', '宏',
  '弘', '洪', '鸿', '承', '城', '程', '子', '梓', '锐', '辰',
  '宸', '忱', '一', '鑫', '品', '众',
];

export const SURNAMES = Array.from(new Set(SURNAMES_RAW));
export const MALE_CHARS = Array.from(new Set(MALE_CHARS_RAW));

export const TEAM_THEMES: Record<string, string[]> = {
  animal: [
    '猛虎', '雄鹰', '战狼', '猎豹', '狂狮', '飞龙', '天狼', '海鹰', '银狼', '青虎',
    '苍鹰', '雪豹', '赤狐', '鲲鹏', '麒麟', '朱雀', '玄武', '白虎', '蓝鲸', '金雕',
  ],
  nature: [
    '雷霆', '风暴', '闪电', '疾风', '烈火', '狂风', '怒涛', '惊雷', '银河', '星辰',
    '极光', '冰川', '烈阳', '山岳', '沧海', '激流', '飓风', '流星', '潮汐', '峰峦',
  ],
  wuxia: [
    '剑客', '龙吟', '虎啸', '风云', '龙腾', '虎跃', '金盾', '银箭', '利剑', '坚盾',
    '破军', '长虹', '飞鸿', '铁骑', '御林', '锋芒', '逐风', '凌云', '苍穹', '侠客',
  ],
  glory: [
    '荣耀', '辉煌', '传奇', '王者', '冠军', '英雄', '勇士', '战神', '永恒', '巅峰',
    '凯旋', '荣光', '威武', '无双', '凯歌', '雄风', '卓越', '豪杰', '圣殿', '王座',
  ],
  time: [
    '破晓', '黎明', '曙光', '晨曦', '朝阳', '旭日', '晨光', '晓月', '新星', '启明',
    '恒星', '烈日', '皓月', '星火', '初阳', '暮光',
  ],
  industry: [
    '海港', '铁工', '矿工', '航运', '重工', '钢铁', '灯塔', '工匠', '机械', '铁路',
    '电力', '造船', '建工', '航天', '远洋', '港务',
  ],
  spirit: [
    '先锋', '开拓者', '守护者', '征服者', '突击', '火炬', '红星', '蓝盾', '金靴', '绿茵',
    '奔腾', '跃动', '铁血', '疾驰', '信念', '热忱',
  ],
};

export const TEAM_MODIFIERS = ['皇家', '新', '大', '铁血', '东方', '北境', '南粤', '西域', '华东', '中州'];

export const TEAM_SUFFIXES = [
  'FC', '联队', '竞技', '足球俱乐部', '战队', '军团',
  '联合', '城', '流浪者', '体育', '人', '青年', '队',
];

/**
 * 覆盖全国 34 个省级行政区（4直辖市 + 23省 + 5自治区 + 2特别行政区）及主要地级市/足球名城
 */
export const REGIONAL_KEYWORDS: Array<{ region: string; keywords: string[] }> = [
  // 4 直辖市
  { region: '北京', keywords: ['燕京', '京华', '长城', '紫禁', '皇城'] },
  { region: '上海', keywords: ['申城', '浦江', '外滩', '东海', '沪上'] },
  { region: '天津', keywords: ['津门', '海河', '渤海', '卫城'] },
  { region: '重庆', keywords: ['山城', '巴渝', '两江', '嘉陵'] },

  // 华北：河北、山西、内蒙古
  { region: '河北', keywords: ['燕赵', '冀中', '太行'] },
  { region: '石家庄', keywords: ['滹沱', '正定', '西柏坡'] },
  { region: '唐山', keywords: ['冀东', '凤凰城', '曹妃甸'] },
  { region: '保定', keywords: ['古城', '白洋淀', '直隶'] },
  { region: '秦皇岛', keywords: ['山海关', '北戴河', '渤海湾'] },
  { region: '邯郸', keywords: ['赵都', '丛台'] },
  { region: '山西', keywords: ['三晋', '晋阳', '表里山河'] },
  { region: '太原', keywords: ['并州', '龙城', '汾水'] },
  { region: '大同', keywords: ['云冈', '平城', '北魏'] },
  { region: '内蒙古', keywords: ['草原', '漠北', '阴山'] },
  { region: '呼和浩特', keywords: ['青城', '敕勒川'] },
  { region: '包头', keywords: ['鹿城', '钢城'] },
  { region: '鄂尔多斯', keywords: ['暖城', '天骄'] },

  // 东北：辽宁、吉林、黑龙江
  { region: '辽宁', keywords: ['辽河', '辽东', '白山黑水'] },
  { region: '沈阳', keywords: ['盛京', '浑河', '奉天'] },
  { region: '大连', keywords: ['星海', '滨城', '足球城'] },
  { region: '鞍山', keywords: ['钢都', '千山'] },
  { region: '吉林', keywords: ['长白', '松花江', '北国'] },
  { region: '长春', keywords: ['春城', '净月', '汽车城'] },
  { region: '延边', keywords: ['长白虎', '海兰江', '图们江'] },
  { region: '黑龙江', keywords: ['龙江', '松嫩', '兴安'] },
  { region: '哈尔滨', keywords: ['冰城', '松花', '太阳岛'] },
  { region: '大庆', keywords: ['铁人', '百湖'] },
  { region: '齐齐哈尔', keywords: ['鹤城', '嫩江'] },

  // 华东：江苏、浙江、安徽、福建、江西、山东、台湾
  { region: '江苏', keywords: ['江南', '江淮', '水韵'] },
  { region: '南京', keywords: ['金陵', '紫金山', '秦淮'] },
  { region: '苏州', keywords: ['姑苏', '太湖', '金鸡湖'] },
  { region: '无锡', keywords: ['锡城', '太湖明珠', '梁溪'] },
  { region: '常州', keywords: ['龙城', '毗陵'] },
  { region: '南通', keywords: ['江海', '狼山'] },
  { region: '徐州', keywords: ['彭城', '汉风', '淮海'] },
  { region: '扬州', keywords: ['广陵', '瘦西湖', '运河'] },
  { region: '浙江', keywords: ['钱塘', '之江', '越州'] },
  { region: '杭州', keywords: ['西湖', '临安', '钱江'] },
  { region: '宁波', keywords: ['甬城', '三江口', '东海港'] },
  { region: '温州', keywords: ['瓯江', '鹿城', '东瓯'] },
  { region: '绍兴', keywords: ['越城', '鉴湖', '会稽'] },
  { region: '嘉兴', keywords: ['南湖', '禾城'] },
  { region: '金华', keywords: ['婺江', '八咏'] },
  { region: '安徽', keywords: ['江淮', '皖中', '徽州'] },
  { region: '合肥', keywords: ['庐州', '巢湖', '科创'] },
  { region: '芜湖', keywords: ['江城', '鸠兹'] },
  { region: '黄山', keywords: ['徽韵', '迎客松'] },
  { region: '福建', keywords: ['八闽', '闽江', '海峡'] },
  { region: '福州', keywords: ['榕城', '三坊七巷', '闽都'] },
  { region: '厦门', keywords: ['鹭岛', '鼓浪', '白鹭'] },
  { region: '泉州', keywords: ['刺桐', '海丝', '鲤城'] },
  { region: '江西', keywords: ['赣鄱', '鄱阳湖', '江南西'] },
  { region: '南昌', keywords: ['洪都', '滕王阁', '赣江'] },
  { region: '九江', keywords: ['浔阳', '庐山'] },
  { region: '赣州', keywords: ['虔城', '章贡'] },
  { region: '景德镇', keywords: ['瓷都', '昌江'] },
  { region: '山东', keywords: ['齐鲁', '泰山', '黄海'] },
  { region: '济南', keywords: ['泉城', '趵突', '大明湖'] },
  { region: '青岛', keywords: ['岛城', '栈桥', '黄海湾'] },
  { region: '烟台', keywords: ['芝罘', '仙境', '港城'] },
  { region: '淄博', keywords: ['临淄', '齐都'] },
  { region: '潍坊', keywords: ['鸢都', '风筝'] },
  { region: '威海', keywords: ['威海卫', '刘公岛'] },
  { region: '台湾', keywords: ['宝岛', '海峡', '玉山'] },
  { region: '台北', keywords: ['淡水河', '阳明山'] },
  { region: '高雄', keywords: ['爱河', '打狗港'] },

  // 华中：河南、湖北、湖南
  { region: '河南', keywords: ['中原', '黄河', '嵩山'] },
  { region: '郑州', keywords: ['商都', '绿城', '中岳'] },
  { region: '洛阳', keywords: ['神都', '伊洛', '牡丹'] },
  { region: '开封', keywords: ['汴梁', '东京', '菊城'] },
  { region: '湖北', keywords: ['荆楚', '江汉', '神农'] },
  { region: '武汉', keywords: ['江城', '黄鹤', '三镇'] },
  { region: '宜昌', keywords: ['三峡', '夷陵'] },
  { region: '襄阳', keywords: ['襄樊', '汉水'] },
  { region: '湖南', keywords: ['三湘', '洞庭', '潇湘'] },
  { region: '长沙', keywords: ['星城', '岳麓', '橘洲'] },
  { region: '株洲', keywords: ['动力城', '湘江'] },
  { region: '岳阳', keywords: ['巴陵', '洞庭湖'] },

  // 华南：广东、广西、海南、香港、澳门
  { region: '广东', keywords: ['岭南', '南粤', '珠江'] },
  { region: '广州', keywords: ['羊城', '花城', '越秀'] },
  { region: '深圳', keywords: ['鹏城', '特区', '南山'] },
  { region: '佛山', keywords: ['禅城', '功夫', '岭南'] },
  { region: '东莞', keywords: ['莞邑', '松山湖'] },
  { region: '梅州', keywords: ['客都', '足球之乡', '梅江'] },
  { region: '珠海', keywords: ['百岛', '香炉湾'] },
  { region: '广西', keywords: ['八桂', '漓江', '北部湾'] },
  { region: '南宁', keywords: ['邕城', '绿城', '青秀'] },
  { region: '桂林', keywords: ['山水', '象鼻山'] },
  { region: '柳州', keywords: ['龙城', '柳江'] },
  { region: '海南', keywords: ['琼州', '南海', '椰风'] },
  { region: '海口', keywords: ['椰城', '琼台'] },
  { region: '三亚', keywords: ['鹿城', '天涯'] },
  { region: '香港', keywords: ['香江', '维港', '狮子山'] },
  { region: '澳门', keywords: ['濠江', '镜海', '莲花'] },

  // 西南：四川、贵州、云南、西藏
  { region: '四川', keywords: ['巴蜀', '天府', '蜀中'] },
  { region: '成都', keywords: ['锦官城', '锦江', '蓉城'] },
  { region: '绵阳', keywords: ['涪城', '科技城'] },
  { region: '宜宾', keywords: ['戎州', '三江'] },
  { region: '贵州', keywords: ['黔中', '多彩', '乌江'] },
  { region: '贵阳', keywords: ['筑城', '林城', '甲秀'] },
  { region: '遵义', keywords: ['赤水', '娄山关'] },
  { region: '云南', keywords: ['彩云', '滇池', '红土'] },
  { region: '昆明', keywords: ['春城', '滇中', '西山'] },
  { region: '大理', keywords: ['苍山', '洱海', '风花雪月'] },
  { region: '玉溪', keywords: ['高原', '抚仙湖'] },
  { region: '西藏', keywords: ['雪域', '高原', '雅鲁藏布'] },
  { region: '拉萨', keywords: ['日光城', '布达拉', '雪莲'] },
  { region: '林芝', keywords: ['雪域江南', '雅江'] },

  // 西北：陕西、甘肃、青海、宁夏、新疆
  { region: '陕西', keywords: ['三秦', '秦岭', '关中'] },
  { region: '西安', keywords: ['长安', '古都', '渭水'] },
  { region: '宝鸡', keywords: ['陈仓', '西府'] },
  { region: '延安', keywords: ['圣地', '宝塔山'] },
  { region: '甘肃', keywords: ['陇原', '河西', '丝路'] },
  { region: '兰州', keywords: ['金城', '黄河楼'] },
  { region: '敦煌', keywords: ['飞天', '月牙泉', '阳关'] },
  { region: '青海', keywords: ['三江源', '昆仑', '青海湖'] },
  { region: '西宁', keywords: ['夏都', '湟水'] },
  { region: '宁夏', keywords: ['塞上', '贺兰山', '黄河'] },
  { region: '银川', keywords: ['凤凰城', '西夏'] },
  { region: '新疆', keywords: ['天山', '西域', '昆仑'] },
  { region: '乌鲁木齐', keywords: ['乌市', '红山', '天山雪豹'] },
  { region: '喀什', keywords: ['帕米尔', '丝路明珠'] },
  { region: '伊犁', keywords: ['天马', '草原', '伊宁'] },
];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

/**
 * 生成架空中文男性球员姓名（约 35% 两字名、65% 三字名，复姓仅配单字名）
 */
export function generateChinesePlayerName(usedNames?: Set<string>): string {
  for (let attempt = 0; attempt < 20; attempt++) {
    const surname = pick(SURNAMES);
    const isCompound = surname.length > 1;
    const twoCharGiven = !isCompound && Math.random() < 0.65;

    const c1 = pick(MALE_CHARS);
    let name: string;
    if (twoCharGiven) {
      let c2 = pick(MALE_CHARS);
      if (c2 === c1) c2 = pick(MALE_CHARS);
      name = `${surname}${c1}${c2}`;
    } else {
      name = `${surname}${c1}`;
    }

    if (!usedNames || !usedNames.has(name)) {
      usedNames?.add(name);
      return name;
    }
  }
  return `${pick(SURNAMES)}${pick(MALE_CHARS)}${pick(MALE_CHARS)}`;
}

/**
 * 按全国省市级行政区划 + 拓展词缀库生成架空俱乐部名称
 */
export function generateFictionalClubName(usedNames?: Set<string>): string {
  const themeKeys = Object.keys(TEAM_THEMES);
  for (let attempt = 0; attempt < 40; attempt++) {
    const reg = pick(REGIONAL_KEYWORDS);
    const theme = pick(TEAM_THEMES[pick(themeKeys)]);
    const suffix = pick(TEAM_SUFFIXES);
    const roll = Math.random();
    const name =
      roll < 0.40 ? `${reg.region}${theme}${suffix}` :
      roll < 0.68 ? `${pick(reg.keywords)}${theme}${suffix}` :
      roll < 0.86 ? `${reg.region}${pick(reg.keywords)}${suffix}` :
      `${pick(TEAM_MODIFIERS)}${reg.region}${theme}${suffix}`;

    if (!usedNames || !usedNames.has(name)) {
      usedNames?.add(name);
      return name;
    }
  }
  return `${pick(REGIONAL_KEYWORDS).region}${pick(TEAM_THEMES.glory)}${pick(TEAM_SUFFIXES)}`;
}
