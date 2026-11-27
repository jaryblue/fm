/**
 * 球场空间评估器：xT（期望威胁值）、xG（期望进球）、越位线与传球通道安全度
 */
import { PITCH, } from './types';
import { clamp, toRelativeX } from './formations';
import { dist2D, pointToSegment } from './physics';
/**
 * 连续期望威胁值 xT(x, y) ∈ [0.02, 0.95]
 * 用于统一评估传球与盘带的空间收益
 */
export function evaluateXT(pos, dir) {
    const relX = toRelativeX(pos.x, dir);
    const distFromCenterY = Math.abs(pos.y - PITCH.HALF_Y);
    // 纵向威胁曲线（分段平滑递增）
    let baseXT;
    if (relX < 35) {
        baseXT = 0.02 + (relX / 35) * 0.05; // 0.02 -> 0.07
    }
    else if (relX < 70) {
        baseXT = 0.07 + ((relX - 35) / 35) * 0.21; // 0.07 -> 0.28
    }
    else if (relX < 88) {
        baseXT = 0.28 + ((relX - 70) / 18) * 0.34; // 0.28 -> 0.62
    }
    else {
        baseXT = 0.62 + ((relX - 88) / 17) * 0.33; // 0.62 -> 0.95
    }
    // 横向修正：禁区附近中路/肋部威胁最高，边路传中区保持较高价值
    const centralBonus = relX > 72
        ? clamp(1.0 - (distFromCenterY / 34) * 0.42, 0.58, 1.0)
        : clamp(1.0 - (distFromCenterY / 34) * 0.14, 0.86, 1.0);
    return baseXT * centralBonus;
}
/**
 * 计算越位线（绝对 X 坐标）：对方倒数第二名防守球员位置（或半场线）
 */
export function getOffsideLineX(attackingTeam, attackDir, players) {
    const defenders = players.filter(p => p.team !== attackingTeam && !p.redCard);
    if (defenders.length < 2)
        return PITCH.HALF_X;
    const sorted = [...defenders].sort((a, b) => attackDir === 1 ? b.pos.x - a.pos.x : a.pos.x - b.pos.x);
    const secondLastX = sorted[1].pos.x;
    // 在本方半场不越位
    if (attackDir === 1) {
        return Math.max(PITCH.HALF_X, secondLastX);
    }
    return Math.min(PITCH.HALF_X, secondLastX);
}
/**
 * 计算射门期望进球值 xG ∈ [0.005, 0.65]
 * 对标五大联赛真实射门分布（禁区外远射 0.02~0.06，禁区内 0.10~0.38）
 */
export function computeShotXG(shooter, attackDir, players) {
    const goalX = attackDir === 1 ? PITCH.LENGTH : 0;
    const dist = dist2D(shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
    if (dist > 34)
        return 0.004;
    // 球门可视张角（两条门柱夹角）
    const p1 = { x: goalX, y: PITCH.GOAL_Y - PITCH.GOAL_HALF_WIDTH };
    const p2 = { x: goalX, y: PITCH.GOAL_Y + PITCH.GOAL_HALF_WIDTH };
    const a1 = Math.atan2(p1.y - shooter.pos.y, p1.x - shooter.pos.x);
    const a2 = Math.atan2(p2.y - shooter.pos.y, p2.x - shooter.pos.x);
    let angle = Math.abs(a2 - a1);
    if (angle > Math.PI)
        angle = 2 * Math.PI - angle;
    // 基础距离衰减 + 角度加成
    const distFactor = Math.exp(-dist / 11.5);
    const angleFactor = clamp(angle / 0.65, 0.22, 1.2);
    let xG = 0.52 * distFactor * angleFactor;
    // 门前防守压迫与封堵人数惩罚
    let pressurePenalty = 1.0;
    for (const opp of players) {
        if (opp.team === shooter.team || opp.redCard || opp.role === 'GK')
            continue;
        const dToShooter = dist2D(opp.pos, shooter.pos);
        if (dToShooter < 2.8) {
            pressurePenalty *= 0.72;
        }
        else {
            const seg = pointToSegment(opp.pos, shooter.pos, { x: goalX, y: PITCH.GOAL_Y });
            if (seg.t > 0.05 && seg.t < 0.7 && seg.dist < 1.8) {
                pressurePenalty *= 0.80;
            }
        }
    }
    // 个人射术与冷静修正 (0.8 ~ 1.2)
    const skillFactor = 0.78 + ((shooter.attributes.shooting * 0.65 + shooter.attributes.composure * 0.35) / 99) * 0.44;
    // 词条实装加成：禁区狐狸 / 远射重炮
    let traitMul = 1.0;
    if (dist < 16.5 && shooter.traits?.includes('禁区狐狸'))
        traitMul *= 1.18;
    if (dist >= 18 && shooter.traits?.includes('远射重炮'))
        traitMul *= 1.25;
    xG = clamp(xG * pressurePenalty * skillFactor * traitMul, 0.008, 0.68);
    return xG;
}
/**
 * 评估传球通道完成概率 ∈ [0.15, 0.97]
 */
export function evaluatePassCompletion(passer, target, players, isLofted) {
    const d = dist2D(passer.pos, target.pos);
    // 基础距离衰减
    let prob = d < 12 ? 0.96 : d < 25 ? 0.96 - (d - 12) * 0.009 : Math.max(0.50, 0.84 - (d - 25) * 0.012);
    // 持球人自身受压迫程度
    let passerPressure = 0;
    let targetPressure = 0;
    let corridorRisk = 0;
    for (const opp of players) {
        if (opp.team === passer.team || opp.redCard)
            continue;
        const dp = dist2D(opp.pos, passer.pos);
        if (dp < 3.0)
            passerPressure += (3.0 - dp) * 0.05;
        const dt = dist2D(opp.pos, target.pos);
        if (dt < 4.5)
            targetPressure += (4.5 - dt) * 0.035;
        // 非高空球检查传球路径走廊上的拦截风险
        if (!isLofted) {
            const seg = pointToSegment(opp.pos, passer.pos, target.pos);
            if (seg.t > 0.12 && seg.t < 0.88 && seg.dist < 3.2) {
                corridorRisk += (3.2 - seg.dist) * 0.11;
            }
        }
    }
    const skillBonus = ((passer.attributes.passing - 60) / 100) * 0.12;
    const traitPassBonus = (passer.traits?.includes('节拍器') ? 0.05 : 0) +
        (isLofted && passer.traits?.includes('精准长传') ? 0.07 : 0);
    prob = prob + skillBonus + traitPassBonus - passerPressure - targetPressure - corridorRisk;
    return clamp(prob, 0.18, 0.97);
}
