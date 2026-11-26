/**
 * 赛季故事线开局简报与第 3 / 5 轮中期 2 选 1 剧情抉择事件
 */

import { PendingStoryEvent, SeasonStoryline } from './types';

export function createOpeningBriefing(
  storyline: SeasonStoryline,
  clubName: string
): PendingStoryEvent {
  const bodies: Record<SeasonStoryline['id'], string> = {
    underdog: `新赛季战幕拉开，外界普遍将【${clubName}】视作联赛陪跑者。但你深知这支球队的韧性——每次迎战积分榜前四强队，全队速度与冷静都将获得激发，赛季末更可获得 +25% 额外声望点(Meta)结算奖励。`,
    revenge: `本赛季【${clubName}】的更衣室里挂着宿敌的名字。每次与宿敌交锋，全队射门与抢断都将提升 +5，用一场胜利回应所有的质疑！`,
    veteran: `这或许是队内多位 28 岁以上老将共同征战的最后一个赛季。老将们在场上将获得全属性 +4 加成，让我们为他们献上最体面的告别演出。`,
    wonderkid: `【${clubName}】本赛季启用了一批朝气蓬勃的年轻面孔。23 岁及以下球员每踢完一轮比赛都将稳定成长（传/射/速各 +1），用青春风暴席卷联赛吧！`,
  };

  return {
    id: `story_brief_${storyline.id}`,
    kind: 'briefing',
    round: 1,
    badge: `赛季剧本 · ${storyline.title}`,
    title: `${clubName} · 赛季启程简报`,
    body: bodies[storyline.id],
    options: [
      {
        id: 'confirm_start',
        label: '接下战书 · 踏上征程 ▶',
        effectDesc: storyline.description,
      },
    ],
  };
}

export function createMidSeasonChoice(
  storyline: SeasonStoryline,
  round: number
): PendingStoryEvent {
  if (round === 3) {
    if (storyline.id === 'underdog') {
      return {
        id: 'story_r3_underdog',
        kind: 'choice',
        round: 3,
        badge: '逆袭故事 · 第 3 轮事件',
        title: '赛前舆论持续看衰',
        body: '两轮战罢，媒体专栏依然把你们列为“降级热门”。更衣室里大家都在看你的态度，你决定如何回应？',
        options: [
          {
            id: 'r3_u_a',
            label: '闭门加练反击演练',
            effectDesc: '全队速度 +3、传球 +2',
            effect: { paceBonus: 3, passingBonus: 2 },
          },
          {
            id: 'r3_u_b',
            label: '发布会立下军令状',
            effectDesc: '全队射门 +3，立即获得 +15 声望点(Meta)',
            effect: { shootingBonus: 3 },
            metaPointsDelta: 15,
          },
        ],
      };
    }
    if (storyline.id === 'revenge') {
      return {
        id: 'story_r3_revenge',
        kind: 'choice',
        round: 3,
        badge: '复仇故事 · 第 3 轮事件',
        title: '宿敌主帅赛前口水战',
        body: '宿敌主教练在采访中嘲讽你们的打法“毫无新意”。消息传回训练基地，球员们摩拳擦掌。',
        options: [
          {
            id: 'r3_r_a',
            label: '铁血回应：强化对抗逼抢',
            effectDesc: '全队防守 +4、射门 +2',
            effect: { defendingBonus: 4, shootingBonus: 2 },
          },
          {
            id: 'r3_r_b',
            label: '冷静应对：打磨传控节奏',
            effectDesc: '全队传球 +4、体能 +3',
            effect: { passingBonus: 4, staminaBonus: 3 },
          },
        ],
      };
    }
    if (storyline.id === 'veteran') {
      return {
        id: 'story_r3_veteran',
        kind: 'choice',
        round: 3,
        badge: '告别故事 · 第 3 轮事件',
        title: '老将体能出现波动',
        body: '高强度赛程下，几名 28 岁以上的核心老将出现了肌肉酸痛反应，队医希望你定夺本周训练重点。',
        options: [
          {
            id: 'r3_v_a',
            label: '老将核心力量特训',
            effectDesc: '28 岁及以上老将防守 +3、冷静 +3',
            veteranBoost: true,
          },
          {
            id: 'r3_v_b',
            label: '全队轻量恢复调整',
            effectDesc: '全队体能 +5',
            effect: { staminaBonus: 5 },
          },
        ],
      };
    }
    return {
      id: 'story_r3_wonderkid',
      kind: 'choice',
      round: 3,
      badge: '新星故事 · 第 3 轮事件',
      title: '年轻球员渴望更多球权',
      body: '青训新星们在训练中状态火热，进攻组小将希望你在战术上给他们更多自由开火权。',
      options: [
        {
          id: 'r3_w_a',
          label: '放权年轻进攻手',
          effectDesc: '23 岁及以下球员传球 +2、射门 +2',
          youngBoost: true,
        },
        {
          id: 'r3_w_b',
          label: '先稳固中后场基石',
          effectDesc: '全队防守 +3、门将扑救 +3',
          effect: { defendingBonus: 3, goalkeepingBonus: 3 },
        },
      ],
    };
  }

  // Round 5 剧情抉择
  if (storyline.id === 'underdog') {
    return {
      id: 'story_r5_underdog',
      kind: 'choice',
      round: 5,
      badge: '逆袭故事 · 第 5 轮关键抉择',
      title: '赛季中段抢分冲刺',
      body: '赛季渐入中段，球队的韧性已让不少对手刮目相看。更衣室士气正盛，接下来几轮的抢分节奏至关重要，你选择哪种策略？',
      options: [
        {
          id: 'r5_u_a',
          label: '孤注一掷全力进攻',
          effectDesc: '全队射门 +4、速度 +2',
          effect: { shootingBonus: 4, paceBonus: 2 },
        },
        {
          id: 'r5_u_b',
          label: '稳守反击保住席位',
          effectDesc: '全队防守 +4、传球 +2',
          effect: { defendingBonus: 4, passingBonus: 2 },
        },
      ],
    };
  }
  if (storyline.id === 'revenge') {
    return {
      id: 'story_r5_revenge',
      kind: 'choice',
      round: 5,
      badge: '复仇故事 · 第 5 轮关键抉择',
      title: '死忠球迷看台助威',
      body: '俱乐部球迷协会在训练场外挂起了巨型助威横幅，期待球队在冲刺阶段压过宿敌。',
      options: [
        {
          id: 'r5_r_a',
          label: '攻势足球回馈球迷',
          effectDesc: '全队射门 +4、速度 +2',
          effect: { shootingBonus: 4, paceBonus: 2 },
        },
        {
          id: 'r5_r_b',
          label: '铁血零封务实抢分',
          effectDesc: '全队防守 +4、体能 +3',
          effect: { defendingBonus: 4, staminaBonus: 3 },
        },
      ],
    };
  }
  if (storyline.id === 'veteran') {
    return {
      id: 'story_r5_veteran',
      kind: 'choice',
      round: 5,
      badge: '告别故事 · 第 5 轮关键抉择',
      title: '老将更衣室誓师演讲',
      body: '队内老将召集全队围成一圈，激励大家珍惜剩下的每一分钟。他们愿意把所有经验倾注在这几场比赛中。',
      options: [
        {
          id: 'r5_v_a',
          label: '传承经验：全队磨合传切',
          effectDesc: '全队传球 +3、射门 +2',
          effect: { passingBonus: 3, shootingBonus: 2 },
        },
        {
          id: 'r5_v_b',
          label: '最后一舞：老将全力冲刺',
          effectDesc: '28 岁及以上老将防守 +3、冷静 +3',
          veteranBoost: true,
        },
      ],
    };
  }
  return {
    id: 'story_r5_wonderkid',
    kind: 'choice',
    round: 5,
    badge: '新星故事 · 第 5 轮关键抉择',
    title: '球探云集看台观战',
    body: '多支顶级联赛的球探今天坐在看台观察你们的年轻球员，这既是压力也是证明自己的舞台。',
    options: [
      {
        id: 'r5_w_a',
        label: '鼓励新星大胆发挥',
        effectDesc: '23 岁及以下球员传球 +2、射门 +2，Meta +20',
        youngBoost: true,
        metaPointsDelta: 20,
      },
      {
        id: 'r5_w_b',
        label: '强调团队纪律优先',
        effectDesc: '全队传球 +3、防守 +3',
        effect: { passingBonus: 3, defendingBonus: 3 },
      },
    ],
  };
}
