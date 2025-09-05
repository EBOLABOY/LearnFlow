// SmartEdu Options - 使用统一数据源的选项页面配置
// 动态生成基于 config.js 的课程配置界面

// 课程数据源（在实际使用时这会从全局配置获取）
const SMARTEDU_COURSES = [
    { id: 0, title: "大力弘扬教育家精神", defaultLessons: 10 },
    { id: 1, title: "数字素养提升", defaultLessons: 7 },
    { id: 2, title: "科学素养提升", defaultLessons: 2 },
    { id: 3, title: "心理健康教育能力提升", defaultLessons: 5 },
    { id: 4, title: "学前教育专题培训", defaultLessons: 17 },
    { id: 5, title: "实验室安全管理", defaultLessons: 1 },
    { id: 6, title: "科创劳动教育的实践路径", defaultLessons: 1 },
    { id: 7, title: "特教教师课堂教学专题培训", defaultLessons: 1 }
];

// 动态生成选项页面的课程配置HTML
function generateSmartEduConfigHTML() {
    const coursesHTML = SMARTEDU_COURSES.map(course => `
        <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; align-items: center; margin-bottom: 8px;">
            <div style="font-size: 12px; color: #666;">${course.title}</div>
            <input type="number" id="smartedu-lesson-${course.id}" class="config-input" 
                   min="1" max="50" value="${course.defaultLessons}" style="width: 80px;" />
        </div>
    `).join('');
    
    return `
        <div class="config-group">
            <label class="config-label">课程学习课时配置</label>
            <div style="margin-bottom: 16px;">
                <div style="display: grid; grid-template-columns: 2fr 1fr; gap: 8px; align-items: center; margin-bottom: 8px;">
                    <div style="font-size: 13px; font-weight: 500; color: #555;">课程名称</div>
                    <div style="font-size: 13px; font-weight: 500; color: #555;">需学课时</div>
                </div>
                ${coursesHTML}
            </div>
            <div class="hint">
                📚 配置2025年暑期教师研修各课程需要学习的课时数。设置为 -1 表示学完该课程的所有视频。
            </div>
        </div>
    `;
}

console.log('[深学助手] SmartEdu 选项页面配置生成器已加载');