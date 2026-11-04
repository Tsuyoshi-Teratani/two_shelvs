// 視線（カメラ）のピッチ/ヨー角の時系列から、
// 「縦方向への素早い1往復」「横方向への素早い1往復」を検出する。
//
// Three.js/XRに依存しない純粋なロジックにしてあるので単体テストしやすく、
// 将来スマホのジャイロ(DeviceOrientation)など別の入力ソースにも転用できる。

export interface SwingDetectorOptions {
  /** 判定に使う直近の時間窓(ms) */
  windowMs?: number;
  /** 「往復した」とみなす最小振れ幅(度) */
  amplitudeThresholdDeg?: number;
  /** 直交軸の振れがこの値以下なら、狙った軸の往復とみなす(度) */
  crossAxisLimitDeg?: number;
  /** 1回判定した後、再判定するまでの不応期(ms) */
  cooldownMs?: number;
}

export type SwingAxis = 'vertical' | 'horizontal';

interface Sample {
  t: number;
  pitch: number; // 基準角度からの相対値(度)
  yaw: number; // 基準角度からの相対値(度)
}

const DEFAULTS: Required<SwingDetectorOptions> = {
  windowMs: 900,
  amplitudeThresholdDeg: 8,
  crossAxisLimitDeg: 5,
  cooldownMs: 400,
};

export class GazeSwingDetector {
  private samples: Sample[] = [];
  private baseline: { pitch: number; yaw: number } | null = null;
  private cooldownUntil = 0;
  private readonly opts: Required<SwingDetectorOptions>;

  constructor(options: SwingDetectorOptions = {}) {
    this.opts = { ...DEFAULTS, ...options };
  }

  /** 注視対象が変わった時、または対象を注視し始めた瞬間に呼び、基準角度をリセットする */
  reset(): void {
    this.samples = [];
    this.baseline = null;
  }

  /**
   * 毎フレーム呼び出す。pitch/yawはラジアン（カメラの向き）。
   * ジェスチャーを検出した場合はその軸を、していなければnullを返す。
   */
  update(nowMs: number, pitchRad: number, yawRad: number): SwingAxis | null {
    const pitchDeg = (pitchRad * 180) / Math.PI;
    const yawDeg = (yawRad * 180) / Math.PI;

    if (!this.baseline) {
      this.baseline = { pitch: pitchDeg, yaw: yawDeg };
    }

    this.samples.push({
      t: nowMs,
      pitch: pitchDeg - this.baseline.pitch,
      yaw: yawDeg - this.baseline.yaw,
    });
    const cutoff = nowMs - this.opts.windowMs;
    this.samples = this.samples.filter((s) => s.t >= cutoff);

    if (nowMs < this.cooldownUntil || this.samples.length < 2) return null;

    const pitches = this.samples.map((s) => s.pitch);
    const yaws = this.samples.map((s) => s.yaw);

    const pitchMax = Math.max(...pitches);
    const pitchMin = Math.min(...pitches);
    const yawMax = Math.max(...yaws);
    const yawMin = Math.min(...yaws);

    const pitchRange = pitchMax - pitchMin;
    const yawRange = yawMax - yawMin;
    const pitchCrossesBaseline = pitchMax > 0 && pitchMin < 0;
    const yawCrossesBaseline = yawMax > 0 && yawMin < 0;

    const isVertical =
      pitchRange >= this.opts.amplitudeThresholdDeg &&
      pitchCrossesBaseline &&
      yawRange <= this.opts.crossAxisLimitDeg;

    const isHorizontal =
      yawRange >= this.opts.amplitudeThresholdDeg &&
      yawCrossesBaseline &&
      pitchRange <= this.opts.crossAxisLimitDeg;

    if (isVertical || isHorizontal) {
      this.cooldownUntil = nowMs + this.opts.cooldownMs;
      // 判定直後の姿勢を次の基準にして、連続したジェスチャーにも追従できるようにする
      this.baseline = { pitch: pitchDeg, yaw: yawDeg };
      this.samples = [];
      return isVertical ? 'vertical' : 'horizontal';
    }

    return null;
  }
}
