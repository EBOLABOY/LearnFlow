// 通用表格组件（Tailwind 样式复用）
// 注意：此文件需使用 UTF-8 编码

export default function Table({ columns, data, loading, sort, onSort }) {
  // 1) 加载态
  if (loading) {
    return (
      <div className="flex items-center justify-center h-64">
        <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-primary-600"></div>
      </div>
    );
  }

  // 2) 空态
  if (!data || data.length === 0) {
    return (
      <div className="text-center py-16 text-gray-500">
        <p className="text-lg">暂无数据</p>
        <p className="text-sm mt-2">请尝试调整筛选条件或刷新页面。</p>
      </div>
    );
  }

  // 3) 表格
  return (
    <div className="table-container">
      <table className="table">
        <thead className="table-header">
          <tr>
            {columns.map((col) => {
              const isSortable = !!col.sortable && !!onSort;
              const sortKey = col.sortKey || col.key;
              const isActive = isSortable && sort && sort.key === sortKey;
              const arrow = isSortable ? (isActive ? (sort.direction === 'asc' ? ' ▲' : ' ▼') : ' ↕') : '';
              const style = col.width ? { width: col.width } : undefined;
              const className = `table-header-cell ${isSortable ? 'cursor-pointer select-none' : ''}`;
              return (
                <th
                  key={col.key}
                  className={className}
                  style={style}
                  onClick={() => {
                    if (isSortable) onSort(sortKey);
                  }}
                  title={isSortable ? '点击切换排序' : undefined}
                >
                  {col.header}{arrow}
                </th>
              );
            })}
          </tr>
        </thead>
        <tbody className="table-body">
          {data.map((row, rowIndex) => (
            <tr key={row.id ?? rowIndex}>
              {columns.map((col) => (
                <td key={`${col.key}-${row.id ?? rowIndex}`} className="table-cell">
                  {col.render ? col.render(row) : row[col.key]}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}
