/**
 * 基于《20_比赛事件文本模板.json》与《32_比赛文字直播系统设计.md》的叙事解说引擎
 * 包含 NarrativeState 状态机（梅开二度、帽子戏法、绝杀、连续射门压制、闷战氛围）
 * 零外部 JSON/fs 依赖，可直接打包至 Steam 与微信小游戏
 */

import { TeamSide } from './types';

export type CommentaryLevel = 'critical' | 'important' | 'normal' | 'minor' | 'phase';
export type NarrativeTag = 'BRACE' | 'HATTRICK' | 'LATE_WINNER' | 'MOMENTUM' | 'LULL';

export interface CommentaryResult {
  text: string;
  level: CommentaryLevel;
  narrativeTag?: NarrativeTag;
  momentumText?: string;
}

export interface GoalContext {
  minute: number;
  team: TeamSide;
  player: string;
  assist?: string;
  homeScore: number;
  awayScore: number;
  shotType?: 'normal' | 'long_range' | 'header' | 'penalty';
}

const TEMPLATES = {
  goal_normal: [
    '{player}一脚劲射，皮球直挂死角！{team}取得进球！',
    '{player}在禁区内冷静推射远角破门！{team}将比分改写为{score}！',
    '{player}带球突入禁区后起脚怒射，皮球像炮弹一样飞入球门！比分{score}！',
    '漂亮！{player}在禁区内晃过防守球员，小角度打门得手！当前比分{score}！',
    '{player}门前抢点，一脚捅射将球送入网窝！{team}攻破对手球门！',
    '神仙球！{player}在包夹下起脚，皮球擦着立柱内侧入网！比分来到{score}！',
    '{player}在禁区前沿拿球，一记贴地斩直窜球门左下角！守门员毫无反应！',
    '{player}利用速度优势甩开后卫，单刀面对门将冷静推射得分！',
    '{player}在混战中抓住机会，一脚扫射将球轰入球门上角！当前{score}！',
    '{player}在禁区内背身拿球转身抽射，皮球直奔球门右上角！',
    '{player}门前倒地铲射！皮球从门将腋下钻入球网！{team}取得关键进球！',
    '又是{player}！他在禁区前沿连续变向闪开空档，兜射远角得手！比分{score}！',
  ],
  goal_assist: [
    '好球！{player}接{assist}妙传，一脚凌空抽射应声入网！比分{score}！',
    '精彩配合！{team}打出流畅团队进攻，{assist}送出关键传球，{player}完成致命一击！',
    '这球太关键了！{player}接{assist}直塞杀入禁区，面对出击的门将挑射破门！当前{score}！',
    '反击进球！{team}发动闪电反击，{assist}长传策动，{player}高速插上爆射破门！',
  ],
  goal_long_range: [
    '世界波！{player}在距离球门二十余米外突施冷箭，皮球划出完美弧线直挂死角！比分{score}！',
    '重炮轰门！{player}外围远射势大力沉，皮球贴着横梁下沿入网！{team}球迷沸腾了！',
  ],
  goal_header: [
    '{player}高高跃起头球攻门！皮球砸在草皮上弹入球网！{team}取得进球！',
    '{player}接传中球抢点头槌破门！门将望球兴叹，比分改写为{score}！',
  ],
  goal_late: [
    '绝杀！{player}在比赛尾声上演致命一击！{team}全队疯狂庆祝！当前比分{score}！',
    '压哨破门！{player}关键时刻挺身而出洞穿球门！{team}改写比分至{score}！',
  ],
  goal_brace: [
    '梅开二度！{player}再次建功，一脚低射穿透门将十指关！{team}比分来到{score}！',
  ],
  goal_hattrick: [
    '🎩 帽子戏法！{player}完成了本场比赛的第三个进球！彻底主宰赛场，比分{score}！',
  ],
  shot_saved: [
    '{player}一脚劲射，{goalkeeper}飞身将球扑出！精彩的扑救！',
    '{player}在禁区内起脚射门，{goalkeeper}反应神速，单掌将球托出横梁！',
    '好险！{player}的射门直奔球门死角，{goalkeeper}鱼跃侧扑将球挡出！',
    '{player}一脚低射直奔球门左下角，{goalkeeper}倒地将球牢牢抱住！',
    '{player}单刀面对门将推射，被{goalkeeper}用脚神勇挡出！',
    '{player}的远射势大力沉，{goalkeeper}飞身将球扑出底线！',
  ],
  shot_missed: [
    '{player}一脚射门偏出球门！{team}错失良机！',
    '{player}的远射高出横梁！这脚射门稍微急了点！',
    '可惜！{player}禁区内一脚推射，皮球擦着立柱偏出！差之毫厘！',
    '{player}带球突入禁区低射滑门而过！太可惜了！',
    '{player}的射门打在边网上！{team}球迷发出一阵叹息！',
    '{player}禁区内转身抽射打飞，{team}的进攻无功而返！',
  ],
  shot_attempt: [
    '{player}外围起脚尝试射门，皮球飞向球门！',
    '{player}禁区前沿果断起脚打门！',
  ],
  foul: [
    '{team}的{player}对{opponent}犯规，主裁判吹罚任意球。',
    '{player}在拼抢中拉倒了{opponent}，犯规！',
    '犯规了！{player}铲倒{opponent}，主裁判果断鸣哨！',
    '{player}在中场战术犯规绊倒{opponent}，破坏了对手的快攻节奏。',
    '{player}带球突破时被{opponent}放倒，主裁判吹停比赛。',
  ],
  yellow_card: [
    '🟨 {player}因为{reason}被主裁判出示黄牌警告！{team}需要控制动作了！',
    '🟨 {player}战术犯规拉倒对手，主裁判果断出示黄牌！',
    '🟨 裁判亮牌了！{player}因{reason}吃到黄牌，教练在场边大喊提醒冷静！',
  ],
  red_card: [
    '🟥 红牌！{player}因{reason}被直接罚下！{team}只能十人应战！',
    '🟥 两黄变一红！{player}累计两张黄牌被罚出场！{team}陷入人数劣势！',
  ],
  offside: [
    '{player}越位了！{team}的这次进攻被边裁举旗吹停。',
    '越位！{player}接直塞球时越位半个身位，进攻意图被识破！',
    '太可惜了！{player}反越位慢了一拍，{team}攻势无功而返。',
  ],
  corner: [
    '{team}获得角球机会，进攻球员纷纷涌入禁区！',
    '{team}制造一次角球，准备开出战术配合！',
  ],
  substitution: [
    '🔄 {team}做出换人调整！{playerOut}被换下，{playerIn}替补登场！',
    '🔄 战术调整！{team}用{playerIn}换下{playerOut}，保持场上冲击力！',
    '🔄 {team}进行人员轮换，{playerIn}替换{playerOut}上场！',
  ],
  kick_off: [
    '比赛开始！{homeTeam}迎战{awayTeam}，主裁判一声哨响，对决正式打响！',
    '好戏开场！{homeTeam} vs {awayTeam}，双方在中圈就位开球！',
  ],
  half_time: [
    '上半场比赛结束！目前比分 {homeTeam} {homeScore} - {awayScore} {awayTeam}！',
    '中场哨响！半场战罢 {homeScore}:{awayScore}，双方返回更衣室调整部署。',
  ],
  full_time: [
    '全场比赛结束！最终比分 {homeTeam} {homeScore} - {awayScore} {awayTeam}！',
    '终场哨响！{homeTeam} {homeScore} - {awayScore} {awayTeam}，感谢双方奉献的精彩对决！',
  ],
  atmosphere: [
    '双方在中场陷入激烈拉锯战，球权频繁易主。',
    '两队阵型保持得很紧凑，场上节奏略显胶着，等待破局机会。',
    '场边主帅不断挥手示意压上，双方在边路展开试探性传导。',
  ],
};

const FOUL_REASONS = ['战术犯规', '背后铲球', '拼抢动作过大', '拉拽球衣'];

function pick<T>(arr: readonly T[]): T {
  return arr[Math.floor(Math.random() * arr.length)];
}

function renderTemplate(tpl: string, vars: Record<string, string | number | undefined>): string {
  let out = tpl;
  for (const [k, v] of Object.entries(vars)) {
    if (v !== undefined) {
      out = out.split(`{${k}}`).join(String(v));
    }
  }
  return out;
}

/**
 * 比赛叙事状态机：追踪个人多球里程碑、连续进攻压制与闷战时长
 */
export class NarrativeState {
  public goalsThisMatch: { home: Record<string, number>; away: Record<string, number> } = {
    home: {},
    away: {},
  };
  public consecutiveShots: { home: number; away: number } = { home: 0, away: 0 };
  public lastEventMinute = 0;
  public momentum: 'home' | 'away' | 'even' = 'even';

  public onGoal(player: string, team: TeamSide, minute: number): 'HATTRICK' | 'BRACE' | null {
    this.lastEventMinute = minute;
    const map = this.goalsThisMatch[team];
    map[player] = (map[player] || 0) + 1;
    const cnt = map[player];
    if (cnt >= 3) return 'HATTRICK';
    if (cnt === 2) return 'BRACE';
    return null;
  }

  public onShot(team: TeamSide, teamName: string, minute: number): string | null {
    this.lastEventMinute = minute;
    const other: TeamSide = team === 'home' ? 'away' : 'home';
    this.consecutiveShots[other] = 0;
    this.consecutiveShots[team]++;

    if (this.consecutiveShots[team] >= 3) {
      this.momentum = team;
      const cnt = this.consecutiveShots[team];
      this.consecutiveShots[team] = 0;
      return `🔥 ${teamName}攻势如潮！短时间内连续完成第 ${cnt} 脚射门压制对手！`;
    }
    return null;
  }

  public markActive(minute: number): void {
    if (minute > this.lastEventMinute) {
      this.lastEventMinute = minute;
    }
  }

  public checkLull(minute: number): string | null {
    if (minute >= 8 && minute <= 86 && minute - this.lastEventMinute >= 6) {
      this.lastEventMinute = minute;
      return pick(TEMPLATES.atmosphere);
    }
    return null;
  }
}

export class CommentaryEngine {
  public readonly narrative = new NarrativeState();
  constructor(private homeName: string, private awayName: string) {}

  private teamName(team: TeamSide): string {
    return team === 'home' ? this.homeName : this.awayName;
  }

  public formatKickoff(minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.kick_off), {
        homeTeam: this.homeName,
        awayTeam: this.awayName,
      }),
      level: 'phase',
    };
  }

  public formatHalftime(minute: number, homeScore: number, awayScore: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.half_time), {
        homeTeam: this.homeName,
        awayTeam: this.awayName,
        homeScore,
        awayScore,
      }),
      level: 'phase',
    };
  }

  public formatFulltime(minute: number, homeScore: number, awayScore: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.full_time), {
        homeTeam: this.homeName,
        awayTeam: this.awayName,
        homeScore,
        awayScore,
      }),
      level: 'phase',
    };
  }

  public formatGoal(ctx: GoalContext): CommentaryResult {
    const milestone = this.narrative.onGoal(ctx.player, ctx.team, ctx.minute);
    const score = `${ctx.homeScore}-${ctx.awayScore}`;
    const team = this.teamName(ctx.team);
    const diff = Math.abs(ctx.homeScore - ctx.awayScore);
    const isLateWinner = ctx.minute >= 85 && diff <= 1;

    let pool = TEMPLATES.goal_normal;
    let narrativeTag: NarrativeTag | undefined;

    if (milestone === 'HATTRICK') {
      pool = TEMPLATES.goal_hattrick;
      narrativeTag = 'HATTRICK';
    } else if (isLateWinner) {
      pool = TEMPLATES.goal_late;
      narrativeTag = 'LATE_WINNER';
    } else if (milestone === 'BRACE') {
      pool = TEMPLATES.goal_brace;
      narrativeTag = 'BRACE';
    } else if (ctx.shotType === 'long_range') {
      pool = TEMPLATES.goal_long_range;
    } else if (ctx.shotType === 'header') {
      pool = TEMPLATES.goal_header;
    } else if (ctx.assist) {
      pool = TEMPLATES.goal_assist;
    }

    const text = renderTemplate(pick(pool), {
      player: ctx.player,
      assist: ctx.assist || '队友',
      team,
      score,
    });

    return { text: `⚽ ${text}`, level: 'critical', narrativeTag };
  }

  public formatShot(team: TeamSide, player: string, xG: number, minute: number): CommentaryResult {
    const momentumText = this.narrative.onShot(team, this.teamName(team), minute) ?? undefined;
    return {
      text: `${renderTemplate(pick(TEMPLATES.shot_attempt), { player })} (xG ${xG.toFixed(2)})`,
      level: 'minor',
      momentumText,
    };
  }

  public formatSave(defTeam: TeamSide, goalkeeper: string, shooter: string, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.shot_saved), {
        goalkeeper,
        player: shooter,
        team: this.teamName(defTeam),
      }),
      level: 'minor',
    };
  }

  public formatMiss(shootTeam: TeamSide, shooter: string, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.shot_missed), {
        player: shooter,
        team: this.teamName(shootTeam),
      }),
      level: 'minor',
    };
  }

  public formatFoul(team: TeamSide, player: string, opponent: string, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.foul), {
        team: this.teamName(team),
        player,
        opponent,
      }),
      level: 'minor',
    };
  }

  public formatYellow(team: TeamSide, player: string, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.yellow_card), {
        team: this.teamName(team),
        player,
        reason: pick(FOUL_REASONS),
      }),
      level: 'important',
    };
  }

  public formatRed(team: TeamSide, player: string, isSecondYellow: boolean, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    const tpl = isSecondYellow ? TEMPLATES.red_card[1] : TEMPLATES.red_card[0];
    return {
      text: renderTemplate(tpl, {
        team: this.teamName(team),
        player,
        reason: pick(FOUL_REASONS),
      }),
      level: 'important',
    };
  }

  public formatOffside(team: TeamSide, player: string, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.offside), {
        team: this.teamName(team),
        player,
      }),
      level: 'minor',
    };
  }

  public formatCorner(team: TeamSide, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.corner), {
        team: this.teamName(team),
      }),
      level: 'minor',
    };
  }

  public formatSubstitution(team: TeamSide, playerIn: string, playerOut: string, minute: number): CommentaryResult {
    this.narrative.markActive(minute);
    return {
      text: renderTemplate(pick(TEMPLATES.substitution), {
        team: this.teamName(team),
        playerIn,
        playerOut,
      }),
      level: 'normal',
    };
  }

  public checkLull(minute: number): CommentaryResult | null {
    const text = this.narrative.checkLull(minute);
    if (!text) return null;
    return { text, level: 'minor', narrativeTag: 'LULL' };
  }
}
