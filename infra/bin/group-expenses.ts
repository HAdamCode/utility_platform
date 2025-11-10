#!/usr/bin/env node
import "source-map-support/register.js";
import { App } from "aws-cdk-lib";
import { GroupExpensesStack } from "../src/stacks/group-expenses-stack.ts";

const app = new App();

new GroupExpensesStack(app, "GroupExpensesStack", {
  env: {
    account: process.env.CDK_DEFAULT_ACCOUNT,
    region: process.env.CDK_DEFAULT_REGION
  }
});

app.synth();
