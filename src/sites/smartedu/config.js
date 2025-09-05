// SmartEdu Configuration - 智慧教育平台统一数据源
// Single Source of Truth for all course and platform information
(() => {
    'use strict';
    
    // 创建命名空间
    const ns = (window.DeepLearn ||= {});
    const siteNS = (ns.sites ||= {});
    const smartedu = (siteNS.smartedu ||= {});
    
    // 2025年暑期教师研修课程配置 - 唯一数据源
    smartedu.COURSES = [
        {
            id: 0,
            title: "大力弘扬教育家精神",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=cb134d8b-ebe5-4953-8c2c-10d27b45b8dc&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 10,
            category: "师德修养",
            priority: 1
        },
        {
            id: 1,
            title: "数字素养提升",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=0bc83fd8-4ee9-4bb2-bf9d-f858ee13ed8f&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 7,
            category: "数字技能",
            priority: 2
        },
        {
            id: 2,
            title: "科学素养提升",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=d21a7e80-cbb4-492a-9625-d8ea8f844515&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 2,
            category: "科学教育",
            priority: 3
        },
        {
            id: 3,
            title: "心理健康教育能力提升",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=e6a702f8-552d-49f6-89e7-b40ce5e445af&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 5,
            category: "心理健康",
            priority: 4
        },
        {
            id: 4,
            title: "学前教育专题培训",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=895caa6f-6c42-411d-ab7c-2b43facebd9f&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 17,
            category: "学前教育",
            priority: 5
        },
        {
            id: 5,
            title: "实验室安全管理",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=e3b6492d-bc7c-4440-ab5e-8d02debd8ceb&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 1,
            category: "安全管理",
            priority: 6
        },
        {
            id: 6,
            title: "科创劳动教育的实践路径",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=1034859d-512f-4696-999d-e736456a75af&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 1,
            category: "劳动教育",
            priority: 7
        },
        {
            id: 7,
            title: "特教教师课堂教学专题培训",
            url: "https://basic.smartedu.cn/teacherTraining/courseDetail?courseId=c5d0f0a7-9047-496e-bb03-e37ea5e65dd7&tag=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98&channelId=&libraryId=bb042e69-9a11-49a1-af22-0c3fab2e92b9&breadcrumb=2025%E5%B9%B4%E2%80%9C%E6%9A%91%E6%9C%9F%E6%95%99%E5%B8%88%E7%A0%94%E4%BF%AE%E2%80%9D%E4%B8%93%E9%A2%98",
            defaultLessons: 1,
            category: "特殊教育",
            priority: 8
        }
    ];
    
    // 平台基础配置
    smartedu.PLATFORM_CONFIG = {
        name: "国家智慧教育平台",
        version: "2.0",
        courseName: "2025年暑期教师研修",
        homeUrl: "https://basic.smartedu.cn/training/2025sqpx",
        watchInterval: 10000, // 监控间隔 10 秒
        autoNext: true,
        supportedDomains: [
            'www.smartedu.cn',
            'basic.smartedu.cn',
            'smartedu.gdtextbook.com',
            'teacher.ykt.eduyun.cn'
        ]
    };
    
    // 便捷方法：获取课程URL列表
    smartedu.getCourseUrls = function() {
        return this.COURSES.map(course => course.url);
    };
    
    // 便捷方法：获取默认课时配置
    smartedu.getDefaultLessons = function() {
        return this.COURSES.map(course => course.defaultLessons);
    };
    
    // 便捷方法：根据ID获取课程信息
    smartedu.getCourseById = function(id) {
        return this.COURSES.find(course => course.id === id);
    };
    
    // 便捷方法：根据URL获取课程信息
    smartedu.getCourseByUrl = function(url) {
        return this.COURSES.find(course => course.url === url);
    };
    
    // 便捷方法：获取课程总数
    smartedu.getCourseCount = function() {
        return this.COURSES.length;
    };
    
    // 便捷方法：验证课程ID是否有效
    smartedu.isValidCourseId = function(id) {
        return id >= 0 && id < this.COURSES.length;
    };
    
    // 便捷方法：获取课程分类列表
    smartedu.getCategories = function() {
        return [...new Set(this.COURSES.map(course => course.category))];
    };
    
    // 便捷方法：根据分类获取课程
    smartedu.getCoursesByCategory = function(category) {
        return this.COURSES.filter(course => course.category === category);
    };
    
    console.log('[深学助手] SmartEdu 配置数据源已加载，课程数量:', smartedu.getCourseCount());
    
})();