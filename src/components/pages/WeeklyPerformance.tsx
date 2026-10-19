import { useState, useEffect } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Skeleton } from '@/components/ui/skeleton';
import {
  LineChart,
  Line,
  XAxis,
  YAxis,
  CartesianGrid,
  Tooltip,
  Legend,
  ResponsiveContainer,
} from 'recharts';
import { TrendingUp, TrendingDown } from 'lucide-react';
import { useAuth } from '@/hooks/useAuth';

interface WeeklyPerformanceData {
  week: string;
  productivity: number;
  quality: number;
}

export default function WeeklyPerformance() {
  const { user, orgId, userRole } = useAuth();
  const [performanceData, setPerformanceData] = useState<WeeklyPerformanceData[]>([]);
  const [loading, setLoading] = useState(true);

  useEffect(() => {
    // Simulate loading
    setLoading(true);
    
    // MOCK DATA: Generate weekly performance data for the last 8 weeks
    const generateMockData = (): WeeklyPerformanceData[] => {
      const weeks: WeeklyPerformanceData[] = [];
      const today = new Date();
      
      for (let i = 7; i >= 0; i--) {
        const weekDate = new Date(today);
        weekDate.setDate(today.getDate() - (i * 7));
        const weekStart = new Date(weekDate);
        weekStart.setDate(weekDate.getDate() - weekDate.getDay()); // Start of week (Sunday)
        
        const weekLabel = `Week ${weekStart.getMonth() + 1}/${weekStart.getDate()}`;
        
        // Generate realistic mock data with some variation
        // Productivity: 60-95% (with some trend)
        const baseProductivity = 75 + (i * 2) + Math.random() * 10 - 5;
        const productivity = Math.max(60, Math.min(95, Math.round(baseProductivity)));
        
        // Quality: 70-98% (generally higher than productivity)
        const baseQuality = 80 + (i * 1.5) + Math.random() * 8 - 4;
        const quality = Math.max(70, Math.min(98, Math.round(baseQuality)));
        
        weeks.push({
          week: weekLabel,
          productivity,
          quality,
        });
      }
      
      return weeks;
    };

    // Simulate API delay
    setTimeout(() => {
      const mockData = generateMockData();
      setPerformanceData(mockData);
      setLoading(false);
    }, 500);
  }, [user, orgId]);

  // Calculate averages and trends
  const avgProductivity = performanceData.length > 0
    ? Math.round(performanceData.reduce((sum, d) => sum + d.productivity, 0) / performanceData.length)
    : 0;
  
  const avgQuality = performanceData.length > 0
    ? Math.round(performanceData.reduce((sum, d) => sum + d.quality, 0) / performanceData.length)
    : 0;

  // Calculate trend (comparing last week to previous week)
  const productivityTrend = performanceData.length >= 2
    ? performanceData[performanceData.length - 1].productivity - performanceData[performanceData.length - 2].productivity
    : 0;
  
  const qualityTrend = performanceData.length >= 2
    ? performanceData[performanceData.length - 1].quality - performanceData[performanceData.length - 2].quality
    : 0;


  // Custom tooltip
  const CustomTooltip = ({ active, payload }: any) => {
    if (active && payload && payload.length) {
      return (
        <div className="bg-white p-3 border rounded-lg shadow-lg">
          <p className="font-semibold mb-2">{payload[0].payload.week}</p>
          {payload.map((entry: any, index: number) => (
            <p key={index} style={{ color: entry.color }} className="text-sm">
              {entry.name}: {entry.value}%
            </p>
          ))}
        </div>
      );
    }
    return null;
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h1 className="text-3xl font-bold tracking-tight">Weekly Performance</h1>
        <p className="text-muted-foreground">
          Track your productivity and quality scores over time
        </p>
      </div>

      {/* Summary Cards */}
      <div className="grid gap-4 md:grid-cols-2">
        {/* Average Productivity Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Productivity</CardTitle>
            <TrendingUp className="h-4 w-4 text-blue-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 mb-2" />
            ) : (
              <>
                <div className="text-2xl font-bold text-blue-600">{avgProductivity}%</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  {productivityTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className={productivityTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(productivityTrend)}% from last week
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>

        {/* Average Quality Card */}
        <Card>
          <CardHeader className="flex flex-row items-center justify-between space-y-0 pb-2">
            <CardTitle className="text-sm font-medium">Average Quality</CardTitle>
            <TrendingUp className="h-4 w-4 text-green-600" />
          </CardHeader>
          <CardContent>
            {loading ? (
              <Skeleton className="h-8 w-20 mb-2" />
            ) : (
              <>
                <div className="text-2xl font-bold text-green-600">{avgQuality}%</div>
                <div className="flex items-center text-xs text-muted-foreground mt-1">
                  {qualityTrend >= 0 ? (
                    <TrendingUp className="h-3 w-3 text-green-600 mr-1" />
                  ) : (
                    <TrendingDown className="h-3 w-3 text-red-600 mr-1" />
                  )}
                  <span className={qualityTrend >= 0 ? 'text-green-600' : 'text-red-600'}>
                    {Math.abs(qualityTrend)}% from last week
                  </span>
                </div>
              </>
            )}
          </CardContent>
        </Card>
      </div>

      {/* Chart Card */}
      <Card>
        <CardHeader>
          <CardTitle>Productivity vs Quality Score</CardTitle>
          <CardDescription>
            Weekly comparison of productivity and quality metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="h-[400px] flex items-center justify-center">
              <Skeleton className="h-full w-full" />
            </div>
          ) : performanceData.length === 0 ? (
            <div className="h-[400px] flex items-center justify-center text-muted-foreground">
              No data available
            </div>
          ) : (
            <ResponsiveContainer width="100%" height={400}>
              <LineChart
                data={performanceData}
                margin={{ top: 5, right: 30, left: 20, bottom: 5 }}
              >
                <CartesianGrid strokeDasharray="3 3" className="stroke-gray-200" />
                <XAxis
                  dataKey="week"
                  className="text-xs"
                  tick={{ fill: '#6b7280' }}
                />
                <YAxis
                  domain={[0, 100]}
                  className="text-xs"
                  tick={{ fill: '#6b7280' }}
                  label={{ value: 'Score (%)', angle: -90, position: 'insideLeft' }}
                />
                <Tooltip content={<CustomTooltip />} />
                <Legend />
                <Line
                  type="monotone"
                  dataKey="productivity"
                  stroke="#3b82f6"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Productivity"
                />
                <Line
                  type="monotone"
                  dataKey="quality"
                  stroke="#10b981"
                  strokeWidth={2}
                  dot={{ r: 4 }}
                  activeDot={{ r: 6 }}
                  name="Quality"
                />
              </LineChart>
            </ResponsiveContainer>
          )}
        </CardContent>
      </Card>

      {/* Data Table */}
      <Card>
        <CardHeader>
          <CardTitle>Weekly Breakdown</CardTitle>
          <CardDescription>
            Detailed weekly performance metrics
          </CardDescription>
        </CardHeader>
        <CardContent>
          {loading ? (
            <div className="space-y-2">
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
              <Skeleton className="h-12 w-full" />
            </div>
          ) : (
            <div className="overflow-x-auto">
              <table className="w-full">
                <thead>
                  <tr className="border-b">
                    <th className="text-left p-3 text-sm font-medium text-gray-700">Week</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Productivity</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Quality</th>
                    <th className="text-right p-3 text-sm font-medium text-gray-700">Difference</th>
                  </tr>
                </thead>
                <tbody>
                  {performanceData.map((data, index) => {
                    const difference = data.quality - data.productivity;
                    return (
                      <tr key={index} className="border-b hover:bg-gray-50">
                        <td className="p-3 text-sm font-medium">{data.week}</td>
                        <td className="p-3 text-sm text-right text-blue-600 font-semibold">
                          {data.productivity}%
                        </td>
                        <td className="p-3 text-sm text-right text-green-600 font-semibold">
                          {data.quality}%
                        </td>
                        <td className={`p-3 text-sm text-right font-semibold ${
                          difference >= 0 ? 'text-green-600' : 'text-red-600'
                        }`}>
                          {difference >= 0 ? '+' : ''}{difference}%
                        </td>
                      </tr>
                    );
                  })}
                </tbody>
              </table>
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  );
}

