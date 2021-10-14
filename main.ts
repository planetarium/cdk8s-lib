import { Construct } from 'constructs';
import { App, Chart, ChartProps } from 'cdk8s';

export class MyChart extends Chart {
  constructor(scope: Construct, id: string, props: ChartProps = { }) {
    super(scope, id, props);
  }
}

const app = new App();
new MyChart(app, 'cdk8s-lib');
app.synth();
