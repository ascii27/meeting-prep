/**
 * Chat Intelligence - Advanced Visualization Components
 * Handles rendering of rich visualizations within chat responses
 */

class ChatIntelligenceVisualizations {
  constructor() {
    this.chartInstances = new Map();
    this.init();
  }

  init() {
    // Load Chart.js if not already loaded
    this.loadChartLibrary();
    this.setupEventListeners();
  }

  loadChartLibrary() {
    if (typeof Chart === 'undefined') {
      const script = document.createElement('script');
      script.src = 'https://cdn.jsdelivr.net/npm/chart.js@4.4.0/dist/chart.umd.js';
      script.onload = () => {
        console.log('Chart.js loaded successfully');
      };
      document.head.appendChild(script);
    }
  }

  setupEventListeners() {
    // Listen for chart action buttons
    document.addEventListener('click', (e) => {
      if (e.target.closest('.chart-action-btn')) {
        this.handleChartAction(e.target.closest('.chart-action-btn'));
      }
    });

    // Listen for org chart node clicks
    document.addEventListener('click', (e) => {
      if (e.target.closest('.org-chart-node')) {
        this.handleOrgNodeClick(e.target.closest('.org-chart-node'));
      }
    });
  }

  /**
   * Create organizational hierarchy chart
   */
  createOrganizationChart(container, data) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chat-chart-container';
    
    chartContainer.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">Organization Hierarchy</h3>
        <div class="chart-actions">
          <button class="chart-action-btn" data-action="expand">Expand All</button>
          <button class="chart-action-btn" data-action="collapse">Collapse</button>
          <button class="chart-action-btn" data-action="export">Export</button>
        </div>
      </div>
      <div class="chart-content" id="org-chart-${Date.now()}">
        <div class="org-chart-container">
          ${this.renderOrgHierarchy(data)}
        </div>
      </div>
    `;
    
    container.appendChild(chartContainer);
    this.setupOrgChartInteractions(chartContainer);
  }

  renderOrgHierarchy(data, level = 0) {
    if (!data || !data.nodes) return '';
    
    const rootNodes = data.nodes.filter(node => !node.managerId || node.managerId === null);
    
    return `
      <div class="org-level org-level-${level}">
        ${rootNodes.map(node => this.renderOrgNode(node, data.nodes, level)).join('')}
      </div>
    `;
  }

  renderOrgNode(node, allNodes, level) {
    const subordinates = allNodes.filter(n => n.managerId === node.id);
    const hasSubordinates = subordinates.length > 0;
    
    return `
      <div class="org-node-container" data-node-id="${node.id}">
        <div class="org-chart-node ${node.isManager ? 'manager' : ''}" data-person-id="${node.id}">
          <div class="node-avatar">
            ${node.name ? node.name.charAt(0).toUpperCase() : '?'}
          </div>
          <div class="node-info">
            <div class="node-name">${node.name || 'Unknown'}</div>
            <div class="node-title">${node.title || node.role || 'No title'}</div>
            <div class="node-department">${node.department || ''}</div>
            ${node.meetingCount ? `<div class="node-stats">${node.meetingCount} meetings</div>` : ''}
          </div>
          ${hasSubordinates ? `
            <button class="node-toggle" data-action="toggle">
              <svg width="12" height="12" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="2">
                <polyline points="6,9 12,15 18,9"></polyline>
              </svg>
            </button>
          ` : ''}
        </div>
        ${hasSubordinates ? `
          <div class="org-subordinates" style="display: block;">
            ${subordinates.map(sub => this.renderOrgNode(sub, allNodes, level + 1)).join('')}
          </div>
        ` : ''}
      </div>
    `;
  }

  /**
   * Create collaboration network visualization
   */
  createCollaborationNetwork(container, data) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chat-chart-container';
    
    const chartId = `collaboration-chart-${Date.now()}`;
    
    chartContainer.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">Collaboration Network</h3>
        <div class="chart-actions">
          <button class="chart-action-btn" data-action="filter-department">By Department</button>
          <button class="chart-action-btn" data-action="filter-frequency">By Frequency</button>
          <button class="chart-action-btn" data-action="reset">Reset View</button>
        </div>
      </div>
      <div class="chart-content">
        <canvas id="${chartId}" width="400" height="300"></canvas>
      </div>
    `;
    
    container.appendChild(chartContainer);
    
    // Create network visualization using Chart.js scatter plot
    setTimeout(() => {
      this.renderCollaborationChart(chartId, data);
    }, 100);
  }

  renderCollaborationChart(chartId, data) {
    const ctx = document.getElementById(chartId);
    if (!ctx || typeof Chart === 'undefined') return;

    const chartData = {
      datasets: [{
        label: 'Collaboration Strength',
        data: data.relationships.map((rel, index) => ({
          x: index % 10,
          y: Math.floor(index / 10),
          r: Math.min(rel.strength * 2, 20),
          person1: rel.person1,
          person2: rel.person2,
          meetingCount: rel.meetingCount
        })),
        backgroundColor: 'rgba(102, 126, 234, 0.6)',
        borderColor: 'rgba(102, 126, 234, 1)',
        borderWidth: 1
      }]
    };

    const chart = new Chart(ctx, {
      type: 'bubble',
      data: chartData,
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const data = context.raw;
                return `${data.person1} ↔ ${data.person2}: ${data.meetingCount} meetings`;
              }
            }
          }
        },
        scales: {
          x: {
            display: false
          },
          y: {
            display: false
          }
        }
      }
    });

    this.chartInstances.set(chartId, chart);
  }

  /**
   * Create meeting frequency timeline
   */
  createMeetingTimeline(container, data) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chat-chart-container';
    
    const chartId = `timeline-chart-${Date.now()}`;
    
    chartContainer.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">Meeting Frequency Timeline</h3>
        <div class="chart-actions">
          <button class="chart-action-btn" data-action="week">Week View</button>
          <button class="chart-action-btn" data-action="month">Month View</button>
          <button class="chart-action-btn" data-action="quarter">Quarter View</button>
        </div>
      </div>
      <div class="chart-content">
        <canvas id="${chartId}" width="400" height="200"></canvas>
      </div>
    `;
    
    container.appendChild(chartContainer);
    
    setTimeout(() => {
      this.renderTimelineChart(chartId, data);
    }, 100);
  }

  renderTimelineChart(chartId, data) {
    const ctx = document.getElementById(chartId);
    if (!ctx || typeof Chart === 'undefined') return;

    const chart = new Chart(ctx, {
      type: 'line',
      data: {
        labels: data.timeline.map(t => new Date(t.date).toLocaleDateString()),
        datasets: [{
          label: 'Meetings',
          data: data.timeline.map(t => t.count),
          borderColor: 'rgba(102, 126, 234, 1)',
          backgroundColor: 'rgba(102, 126, 234, 0.1)',
          fill: true,
          tension: 0.4
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            display: false
          }
        },
        scales: {
          y: {
            beginAtZero: true,
            ticks: {
              stepSize: 1
            }
          }
        }
      }
    });

    this.chartInstances.set(chartId, chart);
  }

  /**
   * Create department statistics chart
   */
  createDepartmentStats(container, data) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chat-chart-container';
    
    const chartId = `dept-stats-${Date.now()}`;
    
    chartContainer.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">Department Statistics</h3>
        <div class="chart-actions">
          <button class="chart-action-btn" data-action="meetings">Meetings</button>
          <button class="chart-action-btn" data-action="people">People</button>
          <button class="chart-action-btn" data-action="collaboration">Collaboration</button>
        </div>
      </div>
      <div class="chart-content">
        <canvas id="${chartId}" width="400" height="250"></canvas>
      </div>
    `;
    
    container.appendChild(chartContainer);
    
    setTimeout(() => {
      this.renderDepartmentChart(chartId, data);
    }, 100);
  }

  renderDepartmentChart(chartId, data) {
    const ctx = document.getElementById(chartId);
    if (!ctx || typeof Chart === 'undefined') return;

    const chart = new Chart(ctx, {
      type: 'doughnut',
      data: {
        labels: data.departments.map(d => d.name),
        datasets: [{
          data: data.departments.map(d => d.meetingCount),
          backgroundColor: [
            'rgba(102, 126, 234, 0.8)',
            'rgba(72, 187, 120, 0.8)',
            'rgba(237, 137, 54, 0.8)',
            'rgba(245, 101, 101, 0.8)',
            'rgba(159, 122, 234, 0.8)',
            'rgba(56, 178, 172, 0.8)'
          ],
          borderWidth: 2,
          borderColor: '#fff'
        }]
      },
      options: {
        responsive: true,
        plugins: {
          legend: {
            position: 'right'
          },
          tooltip: {
            callbacks: {
              label: function(context) {
                const dept = data.departments[context.dataIndex];
                return `${dept.name}: ${dept.meetingCount} meetings (${dept.peopleCount} people)`;
              }
            }
          }
        }
      }
    });

    this.chartInstances.set(chartId, chart);
  }

  /**
   * Create topic evolution visualization
   */
  createTopicEvolution(container, data) {
    const chartContainer = document.createElement('div');
    chartContainer.className = 'chat-chart-container';
    
    chartContainer.innerHTML = `
      <div class="chart-header">
        <h3 class="chart-title">Topic Evolution</h3>
        <div class="chart-actions">
          <button class="chart-action-btn" data-action="trending">Trending</button>
          <button class="chart-action-btn" data-action="declining">Declining</button>
          <button class="chart-action-btn" data-action="all">All Topics</button>
        </div>
      </div>
      <div class="chart-content">
        <div class="topic-evolution-container">
          ${this.renderTopicBubbles(data.topics)}
        </div>
      </div>
    `;
    
    container.appendChild(chartContainer);
  }

  renderTopicBubbles(topics) {
    return topics.map(topic => {
      const size = Math.min(Math.max(topic.frequency * 20, 40), 120);
      const trend = topic.trend > 0 ? 'trending-up' : topic.trend < 0 ? 'trending-down' : 'stable';
      
      return `
        <div class="topic-bubble ${trend}" style="width: ${size}px; height: ${size}px;" data-topic="${topic.name}">
          <div class="topic-name">${topic.name}</div>
          <div class="topic-count">${topic.count}</div>
          <div class="topic-trend">
            ${trend === 'trending-up' ? '↗' : trend === 'trending-down' ? '↘' : '→'}
          </div>
        </div>
      `;
    }).join('');
  }

  /**
   * Handle chart action buttons
   */
  handleChartAction(button) {
    const action = button.dataset.action;
    const chartContainer = button.closest('.chat-chart-container');
    
    switch (action) {
      case 'expand':
        this.expandOrgChart(chartContainer);
        break;
      case 'collapse':
        this.collapseOrgChart(chartContainer);
        break;
      case 'export':
        this.exportChart(chartContainer);
        break;
      case 'filter-department':
      case 'filter-frequency':
      case 'reset':
        this.filterCollaborationChart(chartContainer, action);
        break;
      default:
        console.log('Chart action:', action);
    }
  }

  /**
   * Handle organization chart interactions
   */
  setupOrgChartInteractions(container) {
    container.addEventListener('click', (e) => {
      if (e.target.closest('.node-toggle')) {
        const toggle = e.target.closest('.node-toggle');
        const nodeContainer = toggle.closest('.org-node-container');
        const subordinates = nodeContainer.querySelector('.org-subordinates');
        
        if (subordinates) {
          const isVisible = subordinates.style.display !== 'none';
          subordinates.style.display = isVisible ? 'none' : 'block';
          
          const icon = toggle.querySelector('svg polyline');
          if (icon) {
            icon.setAttribute('points', isVisible ? '9,6 15,12 9,18' : '6,9 12,15 18,9');
          }
        }
      }
    });
  }

  handleOrgNodeClick(node) {
    const personId = node.dataset.personId;
    if (personId && window.chatInterface) {
      const query = `Tell me more about the person with ID ${personId}`;
      window.chatInterface.sendMessage(query);
    }
  }

  expandOrgChart(container) {
    const subordinates = container.querySelectorAll('.org-subordinates');
    subordinates.forEach(sub => {
      sub.style.display = 'block';
    });
    
    const toggles = container.querySelectorAll('.node-toggle svg polyline');
    toggles.forEach(toggle => {
      toggle.setAttribute('points', '6,9 12,15 18,9');
    });
  }

  collapseOrgChart(container) {
    const subordinates = container.querySelectorAll('.org-subordinates');
    subordinates.forEach(sub => {
      sub.style.display = 'none';
    });
    
    const toggles = container.querySelectorAll('.node-toggle svg polyline');
    toggles.forEach(toggle => {
      toggle.setAttribute('points', '9,6 15,12 9,18');
    });
  }

  exportChart(container) {
    // Implementation for exporting charts
    console.log('Export chart functionality would be implemented here');
  }

  filterCollaborationChart(container, action) {
    // Implementation for filtering collaboration charts
    console.log('Filter collaboration chart:', action);
  }

  /**
   * Cleanup chart instances
   */
  destroyChart(chartId) {
    const chart = this.chartInstances.get(chartId);
    if (chart) {
      chart.destroy();
      this.chartInstances.delete(chartId);
    }
  }

  destroyAllCharts() {
    this.chartInstances.forEach((chart, id) => {
      chart.destroy();
    });
    this.chartInstances.clear();
  }
}

// Initialize visualization system
document.addEventListener('DOMContentLoaded', () => {
  window.chatVisualizations = new ChatIntelligenceVisualizations();
});

// Export for use in other modules
if (typeof module !== 'undefined' && module.exports) {
  module.exports = ChatIntelligenceVisualizations;
}
