# 深学助手 UI 设计系统：云境玻璃 (Cloudscape Glass) v2.0

本文件定义了"深学助手"应用的统一视觉语言，旨在确保所有用户界面（扩展、管理后台、注入式UI）的一致性、专业性和美学体验。

## 1. 核心理念

云境玻璃 (Cloudscape Glass) 营造一种如晴空云端般开阔、明亮、纯净的视觉感受。界面元素如同漂浮在云海之上的半透明玻璃，轻盈、柔和且富有层次感。

- 明亮通透: 以浅色系为基底，营造空气感。
- 层次分明: 通过模糊和光影构建深度，区分界面层级。
- 专业中性: 采用蓝色系作为强调色，传达信赖感与科技感。
- 体验一致: 所有用户触点共享同一套设计语言。

## 2. 色彩系统 (Color Palette) v2.0

### 品牌色彩
| 用途 | 颜色名称 (Token) | Hex 值 | 描述 |
| --- | --- | --- | --- |
| 主品牌色 | `--brand-1` | `#3B82F6` | 用于主要按钮、激活状态、焦点辉光 |
| 深品牌色 | `--brand-2` | `#1D4ED8` | 用于渐变或深色背景下的强调 |
| 紫色强调 | `--brand-3` | `#8B5CF6` | 用于品牌渐变的中间色调 |
| 青色强调 | `--brand-4` | `#06B6D4` | 用于品牌渐变的结束色调 |

### 中性色系 (扩展)
| 色阶 | Token | Hex | 用途 |
| --- | --- | --- | --- |
| 25 | `--gray-25` | `#FCFCFD` | 极浅背景 |
| 50 | `--gray-50` | `#F9FAFB` | 表头背景 |
| 100-900 | `--gray-xxx` | 标准灰阶 | 文本、边框、分割线 |
| 950 | `--gray-950` | `#030712` | 深色模式背景 |

### 语义化颜色 (完整色阶)
| 类型 | 50 | 100 | 500 | 600 | 700 |
| --- | --- | --- | --- | --- | --- |
| Success | `#ECFDF5` | `#D1FAE5` | `#10B981` | `#059669` | `#047857` |
| Error | `#FEF2F2` | `#FEE2E2` | `#EF4444` | `#DC2626` | `#B91C1C` |
| Warning | `#FFFBEB` | `#FEF3C7` | `#F59E0B` | `#D97706` | `#B45309` |
| Info | `#EFF6FF` | `#DBEAFE` | `#3B82F6` | `#2563EB` | `#1D4ED8` |

## 3. 玻璃材质 (Glass Material) v2.0

### 基础玻璃
```css
.glass-card {
  background: rgba(255, 255, 255, 0.55);
  backdrop-filter: blur(14px) saturate(160%);
  border: 1px solid rgba(255, 255, 255, 0.45);
  border-radius: var(--radius-lg);
  box-shadow: var(--glass-shadow);
}
```

### 高密度数据玻璃（管理面板）
```css
.glass-card-dense {
  background: rgba(255, 255, 255, 0.8);
  backdrop-filter: blur(10px) saturate(140%);
  border: 1px solid rgba(255, 255, 255, 0.6);
  border-radius: var(--radius-md);
}
```

## 4. 标准化系统 v2.0

### 圆角规范
| Token | 值 | 用途 |
| --- | --- | --- |
| `--radius-xs` | 4px | 小元素、标签 |
| `--radius-sm` | 8px | 按钮、输入框小版本 |
| `--radius-md` | 12px | 输入框、卡片、按钮 |
| `--radius-lg` | 16px | 主要容器、面板 |
| `--radius-xl` | 20px | 大型容器 |

### 阴影层级
| Token | 值 | 用途 |
| --- | --- | --- |
| `--shadow-sm` | `0 1px 2px rgba(0,0,0,0.05)` | 轻微浮起 |
| `--shadow-md` | `0 4px 6px rgba(0,0,0,0.07)` | 标准浮起 |
| `--shadow-lg` | `0 10px 15px rgba(0,0,0,0.1)` | 明显浮起 |
| `--shadow-xl` | `0 20px 25px rgba(0,0,0,0.1)` | 显著浮起 |
| `--shadow-brand` | `0 8px 24px rgba(59,130,246,0.35)` | 品牌色阴影 |

## 5. 排版规范 (Typography) v2.0

- 字体: `-apple-system, BlinkMacSystemFont, "Segoe UI", ...` (系统 UI 字体)
- 品牌标题: `font-size: 20px`, `font-weight: 700`, `letter-spacing: -0.5px`
- 页面/面板标题: `font-size: 28px`, `font-weight: 700`
- 卡片/章节标题: `font-size: 20px`, `font-weight: 600`
- 主要正文/标签: `font-size: 14px`, `font-weight: 500`, `line-height: 1.5`
- 描述/次要文本: `font-size: 13px`, `color: var(--text-secondary)`

## 6. 交互效果 v2.0

### 按钮悬停
```css
.btn-primary:hover {
  transform: translateY(-3px) scale(1.02);
  box-shadow: var(--shadow-brand), 0 4px 12px rgba(139,92,246,0.2);
}
```

### 输入框聚焦
```css
.form-input:focus {
  border-color: var(--brand-1);
  box-shadow: 0 0 0 4px rgba(59,130,246,0.15), var(--shadow-md);
  transform: translateY(-2px);
}
```

### 导航链接
```css
.nav-link:hover {
  transform: translateX(4px);
  box-shadow: var(--shadow-lg);
}
```

## 7. 数据展示优化 v2.0

### 表格样式
- 表头背景: `--gray-25`
- 行间距: `py-5` (更宽松的垂直间距)
- 行高: `leading-relaxed`
- 分割线: `--gray-100` (更轻的分割)

---

## 🎯 优化成果总结

**版本 2.0 相比 1.0 的主要提升：**

✅ **品牌视觉强化** - 多色渐变Logo + 更强的品牌识别度
✅ **信息密度优化** - 更合理的间距系统 + 更好的内容呼吸感
✅ **交互反馈增强** - 更丰富的微交互 + 更直观的状态反馈
✅ **色彩系统完善** - 完整的语义化色阶 + 中性色扩展
✅ **组件标准化** - 统一的圆角和阴影规范
✅ **数据展示优化** - 更适合企业级应用的表格密度

在上述规范基础上开发新的界面与组件，可确保"深学助手"在所有触点的体验统一、专业、持久。

