import React, { useState } from 'react';
import { Button, Card, Input, Select, Textarea } from '../src/index';
import { Modal, Toast, Tabs, Dropdown, Tooltip } from '../src/index';
import { Breadcrumb, Pagination, Table, Badge, StatsCard } from '../src/index';
import { Drawer, DatePicker, Timeline, Steps, Upload } from '../src/index';
import { Alert, Progress, Spinner } from '../src/index';

function App() {
  const [isModalOpen, setIsModalOpen] = useState(false);
  const [isDrawerOpen, setIsDrawerOpen] = useState(false);
  const [toasts, setToasts] = useState([]);
  const [currentPage, setCurrentPage] = useState(1);
  const [currentStep, setCurrentStep] = useState(0);

  const addToast = (variant, message) => {
    const id = Date.now();
    setToasts(prev => [...prev, { id, variant, message }]);
    setTimeout(() => {
      setToasts(prev => prev.filter(t => t.id !== id));
    }, 3000);
  };

  const tabs = [
    { label: '基本信息', content: <div className="p-4">这是基本信息标签页</div> },
    { label: '安全设置', content: <div className="p-4">这是安全设置标签页</div> },
    { label: '通知偏好', content: <div className="p-4">这是通知偏好标签页</div> },
  ];

  const dropdownItems = [
    { label: '编辑', onClick: () => alert('编辑') },
    { label: '复制', onClick: () => alert('复制') },
    { label: '删除', onClick: () => alert('删除') },
  ];

  const breadcrumbItems = [
    { label: '首页', href: '#' },
    { label: '设置', href: '#' },
    { label: '账户', href: '#' },
    { label: '安全设置' },
  ];

  const tableColumns = [
    { key: 'name', title: '姓名' },
    { key: 'dept', title: '部门' },
    { key: 'status', title: '状态' },
  ];

  const tableData = [
    { name: '张三', dept: '技术部', status: <Badge variant="success">在职</Badge> },
    { name: '李四', dept: '销售部', status: <Badge variant="warning">休假</Badge> },
    { name: '王五', dept: '市场部', status: <Badge variant="success">在职</Badge> },
  ];

  const timelineItems = [
    { date: '2026年5月20日', title: '项目启动', content: '完成需求分析和项目规划', completed: true },
    { date: '2026年5月22日', title: 'UI设计完成', content: '完成所有页面的UI设计', completed: true },
    { date: '2026年5月26日', title: '前端开发', content: '使用React + Tailwind CSS进行开发' },
  ];

  const steps = [
    { label: '填写信息' },
    { label: '确认订单' },
    { label: '支付付款' },
    { label: '完成' },
  ];

  return (
    <div className="min-h-screen bg-gray-50 p-8">
      <div className="max-w-6xl mx-auto">
        {/* 标题 */}
        <div className="mb-12">
          <h1 className="font-serif text-4xl font-semibold tracking-wide mb-4">
            反-slop 设计系统测试
          </h1>
          <p className="text-gray-600 leading-relaxed">
            测试所有 22 个 React 组件。有品味的中文字体排版 + 克制的配色 + 有目的动画。
          </p>
        </div>

        {/* 1. Button */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            1. Button - 按钮
          </h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" size="sm">小号按钮</Button>
            <Button variant="primary" size="md">中号按钮</Button>
            <Button variant="primary" size="lg">大号按钮</Button>
            <Button variant="secondary">次要按钮</Button>
            <Button variant="danger">危险按钮</Button>
            <Button variant="ghost">幽灵按钮</Button>
            <Button variant="primary" disabled>禁用按钮</Button>
          </div>
        </section>

        {/* 2. Card */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            2. Card - 卡片
          </h2>
          <div className="grid grid-cols-3 gap-6">
            <Card padding="md">
              <h3 className="font-sans text-lg font-semibold mb-3">基础卡片</h3>
              <p className="text-gray-600 leading-relaxed">这是一个基础卡片示例。</p>
            </Card>
            <Card padding="md" hoverable>
              <h3 className="font-sans text-lg font-semibold mb-3">可悬停卡片</h3>
              <p className="text-gray-600 leading-relaxed">悬停时有上移动画。</p>
            </Card>
            <Card padding="lg">
              <h3 className="font-sans text-lg font-semibold mb-3">大内边距卡片</h3>
              <p className="text-gray-600 leading-relaxed">内边距更大。</p>
            </Card>
          </div>
        </section>

        {/* 3. Input & Select & Textarea */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            3. Input / Select / Textarea
          </h2>
          <div className="max-w-lg space-y-6">
            <Input label="姓名" placeholder="请输入姓名" />
            <Input label="邮箱" type="email" placeholder="name@example.com" error="邮箱格式不正确" />
            <Select 
              label="部门" 
              options={[
                { value: 'tech', label: '技术部' },
                { value: 'sales', label: '销售部' },
                { value: 'market', label: '市场部' },
              ]}
            />
            <Textarea label="留言" placeholder="请输入留言内容" rows={4} />
          </div>
        </section>

        {/* 4. Modal */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            4. Modal - 模态框
          </h2>
          <Button variant="primary" onClick={() => setIsModalOpen(true)}>打开模态框</Button>
          <Modal 
            isOpen={isModalOpen} 
            onClose={() => setIsModalOpen(false)}
            title="提示"
            footer={
              <>
                <Button variant="secondary" onClick={() => setIsModalOpen(false)}>取消</Button>
                <Button variant="primary" onClick={() => setIsModalOpen(false)}>确定</Button>
              </>
            }
          >
            <p>这是一个模态框示例。点击遮罩层或关闭按钮可以关闭。</p>
          </Modal>
        </section>

        {/* 5. Toast */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            6. Toast - 通知
          </h2>
          <div className="flex flex-wrap gap-4">
            <Button variant="primary" onClick={() => addToast('success', '操作成功！')}>成功通知</Button>
            <Button variant="primary" onClick={() => addToast('warning', '请注意检查输入！')}>警告通知</Button>
            <Button variant="primary" onClick={() => addToast('error', '操作失败，请重试！')}>错误通知</Button>
            <Button variant="primary" onClick={() => addToast('info', '有新消息通知')}>信息通知</Button>
          </div>
          {/* Toast 容器 */}
          <div className="fixed top-4 right-4 z-50 flex flex-col gap-3">
            {toasts.map(toast => (
              <Toast key={toast.id} variant={toast.variant} message={toast.message} onClose={() => {}} />
            ))}
          </div>
        </section>

        {/* 7. Tabs */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            8. Tabs - 标签页
          </h2>
          <Tabs tabs={tabs} />
        </section>

        {/* 8. Dropdown */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            9. Dropdown - 下拉菜单
          </h2>
          <Dropdown trigger={<Button variant="primary">操作菜单 ▼</Button>} items={dropdownItems} />
        </section>

        {/* 9. Tooltip */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            10. Tooltip - 工具提示
          </h2>
          <div className="flex gap-4">
            <Tooltip text="这是一个工具提示">
              <Button variant="secondary">悬停查看提示</Button>
            </Tooltip>
            <Tooltip text="此操作不可撤销">
              <Button variant="secondary">点击不会保存</Button>
            </Tooltip>
          </div>
        </section>

        {/* 10. Breadcrumb */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            11. Breadcrumb - 面包屑
          </h2>
          <Breadcrumb items={breadcrumbItems} />
        </section>

        {/* 11. Pagination */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            12. Pagination - 分页
          </h2>
          <Pagination 
            totalPages={10} 
            currentPage={currentPage} 
            onPageChange={setCurrentPage} 
          />
        </section>

        {/* 12. Table */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            13. Table - 表格
          </h2>
          <Table columns={tableColumns} data={tableData} hoverable />
        </section>

        {/* 13. Badge */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            14. Badge - 徽章
          </h2>
          <div className="flex flex-wrap gap-4">
            <Badge variant="success">进行中</Badge>
            <Badge variant="warning">待处理</Badge>
            <Badge variant="error">已取消</Badge>
            <Badge variant="info">已完成</Badge>
          </div>
        </section>

        {/* 14. StatsCard */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            15. StatsCard - 统计卡片
          </h2>
          <div className="grid grid-cols-4 gap-4">
            <StatsCard label="活跃用户" value="12,458" change="↑ 12.5%" changeType="positive" />
            <StatsCard label="总收入" value="¥845,200" change="↑ 8.3%" changeType="positive" />
            <StatsCard label="新增订单" value="1,247" change="↓ 3.2%" changeType="negative" />
            <StatsCard label="转化率" value="24.7%" change="↑ 2.1%" changeType="positive" />
          </div>
        </section>

        {/* 15. Drawer */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            16. Drawer - 抽屉
          </h2>
          <Button variant="primary" onClick={() => setIsDrawerOpen(true)}>打开抽屉</Button>
          <Drawer 
            isOpen={isDrawerOpen} 
            onClose={() => setIsDrawerOpen(false)}
            title="抽屉标题"
            footer={
              <>
                <Button variant="secondary" onClick={() => setIsDrawerOpen(false)}>取消</Button>
                <Button variant="primary" onClick={() => setIsDrawerOpen(false)}>确定</Button>
              </>
            }
          >
            <p>这是一个抽屉组件示例。适合展示附加信息、设置面板、详情页等场景。</p>
          </Drawer>
        </section>

        {/* 16. DatePicker */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            17. DatePicker - 日期选择器
          </h2>
          <div className="max-w-xs">
            <DatePicker label="选择日期" />
          </div>
        </section>

        {/* 17. Timeline */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            18. Timeline - 时间轴
          </h2>
          <Timeline items={timelineItems} />
        </section>

        {/* 18. Steps */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            19. Steps - 步骤条
          </h2>
          <Steps 
            steps={steps} 
            currentStep={currentStep} 
            onStepClick={setCurrentStep} 
          />
          <div className="flex gap-4 mt-8">
            <Button variant="secondary" onClick={() => setCurrentStep(Math.max(0, currentStep - 1))}>上一步</Button>
            <Button variant="primary" onClick={() => setCurrentStep(Math.min(steps.length - 1, currentStep + 1))}>下一步</Button>
          </div>
        </section>

        {/* 19. Upload */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            20. Upload - 上传组件
          </h2>
          <Upload />
        </section>

        {/* 20. Alert */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            21. Alert - 警告提示
          </h2>
          <div className="space-y-4 max-w-2xl">
            <Alert variant="success" title="成功">操作已完成，数据已保存。</Alert>
            <Alert variant="warning" title="警告">请注意检查输入内容。</Alert>
            <Alert variant="error" title="错误">操作失败，请重试。</Alert>
            <Alert variant="info" title="提示">这是一条信息提示。</Alert>
          </div>
        </section>

        {/* 21. Progress */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            22. Progress - 进度条
          </h2>
          <div className="space-y-6 max-w-lg">
            <Progress value={60} showLabel />
            <Progress value={45} variant="success" showLabel />
            <Progress value={30} variant="warning" showLabel />
            <Progress value={15} variant="error" showLabel />
          </div>
        </section>

        {/* 22. Spinner */}
        <section className="mb-12">
          <h2 className="font-serif text-2xl font-semibold mb-6 pb-4 border-b-2 border-gray-200">
            23. Spinner - 加载动画
          </h2>
          <div className="flex items-center gap-8">
            <Spinner size="sm" />
            <Spinner size="md" />
            <Spinner size="lg" />
            <Spinner size="md" variant="primary" />
          </div>
        </section>

      </div>
    </div>
  );
}

export default App;
