'use client';

import { useState, useEffect } from 'react';
import styles from './page.module.css';

interface PodResource {
  cpu: number;
  memory: number;
}

interface ServicePod {
  name: string;
  namespace: string;
  status: string;
  restarts: number;
  age: string;
  node: string;
  resources: {
    requests: PodResource;
    limits: PodResource;
  };
}

interface ServiceWithPods {
  name: string;
  namespace: string;
  type: string;
  clusterIp: string;
  ports: string;
  age: string;
  selector: { [key: string]: string };
  pods: ServicePod[];
  podCount: number;
  totalResources: {
    requests: PodResource;
    limits: PodResource;
  };
}

interface PodMetrics {
  name: string;
  namespace: string;
  cpu: string;
  memory: number;
}

interface Deployment {
  name: string;
  namespace: string;
  ready: string;
  upToDate: number;
  available: number;
  age: string;
}

interface Node {
  name: string;
  status: string;
  roles: string;
  age: string;
  version: string;
  capacity: {
    cpu: number;
    memory: number;
    storage: number;
    pods: number;
  };
  allocatable: {
    cpu: number;
    memory: number;
    storage: number;
    pods: number;
  };
  network: {
    internalIP: string;
    hostname: string;
  };
}

interface NodeMetrics {
  name: string;
  cpu: string;
  memory: string;
}

interface ClusterInfo {
  version: string;
  nodeCount: number;
}

interface ClusterResources {
  cpu: {
    capacity: string;
    allocatable: string;
    usage: string;
    usagePercent: string;
  };
  memory: {
    capacity: string;
    allocatable: string;
    usage: string;
    usagePercent: string;
  };
  storage: {
    capacity: string;
    allocatable: string;
  };
  pods: {
    total: number;
    running: number;
  };
  nodeCount: number;
}

export default function Dashboard() {
  const [servicesWithPods, setServicesWithPods] = useState<ServiceWithPods[]>([]);
  const [podMetrics, setPodMetrics] = useState<PodMetrics[]>([]);
  const [deployments, setDeployments] = useState<Deployment[]>([]);
  const [nodes, setNodes] = useState<Node[]>([]);
  const [nodeMetrics, setNodeMetrics] = useState<NodeMetrics[]>([]);
  const [clusterInfo, setClusterInfo] = useState<ClusterInfo | null>(null);
  const [clusterResources, setClusterResources] = useState<ClusterResources | null>(null);
  const [expandedServices, setExpandedServices] = useState<Set<string>>(new Set());
  const [selectedPod, setSelectedPod] = useState<string | null>(null);
  const [logs, setLogs] = useState<string>('');
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const fetchData = async () => {
    try {
      setLoading(true);
      setError(null);

      const [
        servicesWithPodsRes,
        deploymentsRes,
        nodesRes,
        clusterRes,
        clusterResourcesRes,
        nodeMetricsRes,
        podMetricsRes,
      ] = await Promise.all([
        fetch('/api/services-with-pods'),
        fetch('/api/deployments'),
        fetch('/api/nodes'),
        fetch('/api/cluster-info'),
        fetch('/api/cluster-resources'),
        fetch('/api/metrics/nodes').catch(() => ({ ok: false, json: async () => [] })),
        fetch('/api/metrics/pods').catch(() => ({ ok: false, json: async () => [] })),
      ]);

      if (!servicesWithPodsRes.ok || !deploymentsRes.ok || !nodesRes.ok || !clusterRes.ok) {
        throw new Error('Failed to fetch data from Kubernetes cluster');
      }

      const [servicesData, deploymentsData, nodesData, clusterData, clusterResourcesData] =
        await Promise.all([
          servicesWithPodsRes.json(),
          deploymentsRes.json(),
          nodesRes.json(),
          clusterRes.json(),
          clusterResourcesRes.json(),
        ]);

      setServicesWithPods(servicesData);
      setDeployments(deploymentsData);
      setNodes(nodesData);
      setClusterInfo(clusterData);
      setClusterResources(clusterResourcesData);

      if (nodeMetricsRes.ok) {
        const nodeMetricsData = await nodeMetricsRes.json();
        setNodeMetrics(nodeMetricsData);
      }

      if (podMetricsRes.ok) {
        const podMetricsData = await podMetricsRes.json();
        setPodMetrics(podMetricsData);
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Unknown error occurred');
    } finally {
      setLoading(false);
    }
  };

  const fetchLogs = async (podName: string, namespace: string) => {
    try {
      const response = await fetch(`/api/logs?pod=${podName}&namespace=${namespace}`);
      if (!response.ok) throw new Error('Failed to fetch logs');
      const data = await response.json();
      setLogs(data.logs);
      setSelectedPod(`${namespace}/${podName}`);
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to fetch logs');
    }
  };

  const toggleService = (serviceKey: string) => {
    const newExpanded = new Set(expandedServices);
    if (newExpanded.has(serviceKey)) {
      newExpanded.delete(serviceKey);
    } else {
      newExpanded.add(serviceKey);
    }
    setExpandedServices(newExpanded);
  };

  useEffect(() => {
    fetchData();
    const interval = setInterval(fetchData, 10000); // Refresh every 10 seconds
    return () => clearInterval(interval);
  }, []);

  const getStatusColor = (status: string) => {
    const lowerStatus = status.toLowerCase();
    if (lowerStatus.includes('running') || lowerStatus.includes('ready')) return '#10b981';
    if (lowerStatus.includes('pending')) return '#f59e0b';
    if (lowerStatus.includes('failed') || lowerStatus.includes('error')) return '#ef4444';
    return '#6b7280';
  };

  const getNodeMetric = (nodeName: string) => {
    return nodeMetrics.find((m) => m.name === nodeName);
  };

  const getPodMetric = (podName: string, namespace: string) => {
    return podMetrics.find((m) => m.name === podName && m.namespace === namespace);
  };

  const parseMetricValue = (value: string): number => {
    if (value.endsWith('n')) {
      return parseFloat(value.slice(0, -1)) / 1000000000;
    } else if (value.endsWith('u')) {
      return parseFloat(value.slice(0, -1)) / 1000000;
    } else if (value.endsWith('m')) {
      return parseFloat(value.slice(0, -1)) / 1000;
    } else if (value.endsWith('Ki')) {
      return parseFloat(value.slice(0, -2)) / 1024;
    } else if (value.endsWith('Mi')) {
      return parseFloat(value.slice(0, -2));
    } else if (value.endsWith('Gi')) {
      return parseFloat(value.slice(0, -2)) * 1024;
    }
    return parseFloat(value);
  };

  const getServiceTotalUsage = (service: ServiceWithPods) => {
    let totalCpu = 0;
    let totalMemory = 0;

    service.pods.forEach((pod) => {
      const metric = getPodMetric(pod.name, pod.namespace);
      if (metric) {
        totalCpu += parseFloat(metric.cpu);
        totalMemory += metric.memory;
      }
    });

    return { cpu: totalCpu, memory: totalMemory };
  };

  if (loading && !clusterInfo) {
    return (
      <main className={styles.main}>
        <div className={styles.loading}>Loading Kubernetes cluster data...</div>
      </main>
    );
  }

  if (error) {
    return (
      <main className={styles.main}>
        <div className={styles.error}>
          <h2>Error</h2>
          <p>{error}</p>
          <p className={styles.errorHint}>
            Make sure you have kubectl configured and can access your cluster.
            Try running: <code>kubectl cluster-info</code>
          </p>
          <button onClick={fetchData} className={styles.retryButton}>
            Retry
          </button>
        </div>
      </main>
    );
  }

  return (
    <main className={styles.main}>
      <header className={styles.header}>
        <h1>K3s Cluster Dashboard</h1>
        {clusterInfo && (
          <div className={styles.clusterInfo}>
            <span>Version: {clusterInfo.version}</span>
            <span>Nodes: {clusterInfo.nodeCount}</span>
          </div>
        )}
      </header>

      {clusterResources && (
        <section className={styles.resourceOverview}>
          <h2>Cluster Resources</h2>
          <div className={styles.resourceGrid}>
            <div className={styles.resourceCard}>
              <h3>CPU</h3>
              <div className={styles.resourceValue}>
                {clusterResources.cpu.usage} / {clusterResources.cpu.allocatable} cores
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${clusterResources.cpu.usagePercent}%`,
                    backgroundColor: parseFloat(clusterResources.cpu.usagePercent) > 80 ? '#ef4444' : '#10b981',
                  }}
                />
              </div>
              <div className={styles.resourcePercent}>{clusterResources.cpu.usagePercent}% used</div>
              <div className={styles.resourceDetail}>Capacity: {clusterResources.cpu.capacity} cores</div>
            </div>

            <div className={styles.resourceCard}>
              <h3>Memory</h3>
              <div className={styles.resourceValue}>
                {(parseFloat(clusterResources.memory.usage) / 1024).toFixed(1)} /{' '}
                {(parseFloat(clusterResources.memory.allocatable) / 1024).toFixed(1)} GiB
              </div>
              <div className={styles.progressBar}>
                <div
                  className={styles.progressFill}
                  style={{
                    width: `${clusterResources.memory.usagePercent}%`,
                    backgroundColor: parseFloat(clusterResources.memory.usagePercent) > 80 ? '#ef4444' : '#10b981',
                  }}
                />
              </div>
              <div className={styles.resourcePercent}>{clusterResources.memory.usagePercent}% used</div>
              <div className={styles.resourceDetail}>
                Capacity: {(parseFloat(clusterResources.memory.capacity) / 1024).toFixed(1)} GiB
              </div>
            </div>

            <div className={styles.resourceCard}>
              <h3>Storage</h3>
              <div className={styles.resourceValue}>
                {clusterResources.storage.allocatable} GiB allocatable
              </div>
              <div className={styles.resourceDetail}>
                Total Capacity: {clusterResources.storage.capacity} GiB
              </div>
            </div>

            <div className={styles.resourceCard}>
              <h3>Pods</h3>
              <div className={styles.resourceValue}>
                {clusterResources.pods.running} / {clusterResources.pods.total}
              </div>
              <div className={styles.resourceDetail}>
                {clusterResources.pods.running} running
              </div>
            </div>
          </div>
        </section>
      )}

      <div className={styles.dashboard}>
        <section className={styles.section}>
          <h2>Nodes</h2>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Status</th>
                  <th>CPU Usage</th>
                  <th>Memory Usage</th>
                  <th>Storage</th>
                  <th>Internal IP</th>
                  <th>Version</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {nodes.map((node) => {
                  const metric = getNodeMetric(node.name);
                  const cpuUsage = metric ? parseMetricValue(metric.cpu) : 0;
                  const memoryUsage = metric ? parseMetricValue(metric.memory) : 0;
                  const cpuPercent = node.allocatable.cpu > 0 ? ((cpuUsage / node.allocatable.cpu) * 100).toFixed(1) : '0';
                  const memoryPercent = node.allocatable.memory > 0 ? ((memoryUsage / node.allocatable.memory) * 100).toFixed(1) : '0';

                  return (
                    <tr key={node.name}>
                      <td>
                        <strong>{node.name}</strong>
                        {node.roles && <div className={styles.nodeRole}>{node.roles}</div>}
                      </td>
                      <td>
                        <span
                          className={styles.status}
                          style={{ backgroundColor: getStatusColor(node.status) }}
                        >
                          {node.status}
                        </span>
                      </td>
                      <td>
                        {metric ? (
                          <div className={styles.metricCell}>
                            <div>{cpuUsage.toFixed(2)} / {node.allocatable.cpu} cores</div>
                            <div className={styles.smallProgressBar}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${cpuPercent}%`,
                                  backgroundColor: parseFloat(cpuPercent) > 80 ? '#ef4444' : '#10b981',
                                }}
                              />
                            </div>
                            <div className={styles.metricPercent}>{cpuPercent}%</div>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>
                        {metric ? (
                          <div className={styles.metricCell}>
                            <div>{(memoryUsage / 1024).toFixed(1)} / {(node.allocatable.memory / 1024).toFixed(1)} GiB</div>
                            <div className={styles.smallProgressBar}>
                              <div
                                className={styles.progressFill}
                                style={{
                                  width: `${memoryPercent}%`,
                                  backgroundColor: parseFloat(memoryPercent) > 80 ? '#ef4444' : '#10b981',
                                }}
                              />
                            </div>
                            <div className={styles.metricPercent}>{memoryPercent}%</div>
                          </div>
                        ) : (
                          'N/A'
                        )}
                      </td>
                      <td>
                        {(node.capacity.storage / 1024).toFixed(0)} GiB
                      </td>
                      <td>{node.network.internalIP}</td>
                      <td>{node.version}</td>
                      <td>{node.age}</td>
                    </tr>
                  );
                })}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Deployments</h2>
          <div className={styles.tableContainer}>
            <table className={styles.table}>
              <thead>
                <tr>
                  <th>Name</th>
                  <th>Namespace</th>
                  <th>Ready</th>
                  <th>Up-to-date</th>
                  <th>Available</th>
                  <th>Age</th>
                </tr>
              </thead>
              <tbody>
                {deployments.map((deployment) => (
                  <tr key={`${deployment.namespace}-${deployment.name}`}>
                    <td>{deployment.name}</td>
                    <td>{deployment.namespace}</td>
                    <td>{deployment.ready}</td>
                    <td>{deployment.upToDate}</td>
                    <td>{deployment.available}</td>
                    <td>{deployment.age}</td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </section>

        <section className={styles.section}>
          <h2>Services & Pods</h2>
          <div className={styles.servicesContainer}>
            {servicesWithPods.map((service) => {
              const serviceKey = `${service.namespace}/${service.name}`;
              const isExpanded = expandedServices.has(serviceKey);
              const totalUsage = getServiceTotalUsage(service);

              return (
                <div key={serviceKey} className={styles.serviceCard}>
                  <div className={styles.serviceHeader} onClick={() => toggleService(serviceKey)}>
                    <div className={styles.serviceMainInfo}>
                      <span className={styles.expandIcon}>{isExpanded ? '▼' : '▶'}</span>
                      <div>
                        <div className={styles.serviceName}>{service.name}</div>
                        <div className={styles.serviceNamespace}>{service.namespace}</div>
                      </div>
                    </div>
                    <div className={styles.serviceDetails}>
                      <div className={styles.serviceType}>{service.type}</div>
                      <div className={styles.servicePorts}>{service.ports}</div>
                      <div className={styles.serviceClusterIp}>{service.clusterIp}</div>
                      <div className={styles.servicePodCount}>{service.podCount} pods</div>
                    </div>
                    <div className={styles.serviceResources}>
                      <div className={styles.resourceStat}>
                        <span className={styles.resourceLabel}>CPU Usage:</span>
                        <span className={styles.resourceValue2}>{totalUsage.cpu.toFixed(3)} cores</span>
                      </div>
                      <div className={styles.resourceStat}>
                        <span className={styles.resourceLabel}>Memory Usage:</span>
                        <span className={styles.resourceValue2}>{totalUsage.memory.toFixed(0)} MiB</span>
                      </div>
                      {service.totalResources.requests.cpu > 0 && (
                        <div className={styles.resourceStat}>
                          <span className={styles.resourceLabel}>CPU Requests:</span>
                          <span className={styles.resourceValue2}>{service.totalResources.requests.cpu.toFixed(2)} cores</span>
                        </div>
                      )}
                      {service.totalResources.requests.memory > 0 && (
                        <div className={styles.resourceStat}>
                          <span className={styles.resourceLabel}>Memory Requests:</span>
                          <span className={styles.resourceValue2}>{service.totalResources.requests.memory.toFixed(0)} MiB</span>
                        </div>
                      )}
                    </div>
                  </div>

                  {isExpanded && service.pods.length > 0 && (
                    <div className={styles.podsTable}>
                      <table className={styles.table}>
                        <thead>
                          <tr>
                            <th>Pod Name</th>
                            <th>Status</th>
                            <th>CPU Usage</th>
                            <th>Memory Usage</th>
                            <th>CPU Request</th>
                            <th>Memory Request</th>
                            <th>Restarts</th>
                            <th>Node</th>
                            <th>Age</th>
                            <th>Actions</th>
                          </tr>
                        </thead>
                        <tbody>
                          {service.pods.map((pod) => {
                            const metric = getPodMetric(pod.name, pod.namespace);
                            return (
                              <tr key={pod.name}>
                                <td>{pod.name}</td>
                                <td>
                                  <span
                                    className={styles.status}
                                    style={{ backgroundColor: getStatusColor(pod.status) }}
                                  >
                                    {pod.status}
                                  </span>
                                </td>
                                <td>{metric ? `${metric.cpu} cores` : 'N/A'}</td>
                                <td>{metric ? `${metric.memory} MiB` : 'N/A'}</td>
                                <td>{pod.resources.requests.cpu > 0 ? `${pod.resources.requests.cpu.toFixed(3)} cores` : '-'}</td>
                                <td>{pod.resources.requests.memory > 0 ? `${pod.resources.requests.memory.toFixed(0)} MiB` : '-'}</td>
                                <td>{pod.restarts}</td>
                                <td>{pod.node}</td>
                                <td>{pod.age}</td>
                                <td>
                                  <button
                                    className={styles.logsButton}
                                    onClick={(e) => {
                                      e.stopPropagation();
                                      fetchLogs(pod.name, pod.namespace);
                                    }}
                                  >
                                    Logs
                                  </button>
                                </td>
                              </tr>
                            );
                          })}
                        </tbody>
                      </table>
                    </div>
                  )}

                  {isExpanded && service.pods.length === 0 && (
                    <div className={styles.noPodsMessage}>
                      No pods match this service selector
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </section>

        {selectedPod && (
          <section className={styles.section}>
            <div className={styles.logsHeader}>
              <h2>Logs: {selectedPod}</h2>
              <button
                className={styles.closeButton}
                onClick={() => {
                  setSelectedPod(null);
                  setLogs('');
                }}
              >
                Close
              </button>
            </div>
            <div className={styles.logsContainer}>
              <pre>{logs || 'No logs available'}</pre>
            </div>
          </section>
        )}
      </div>
    </main>
  );
}
