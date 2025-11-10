#!/usr/bin/env node
"use strict";
Object.defineProperty(exports, "__esModule", { value: true });
require("source-map-support/register.js");
const aws_cdk_lib_1 = require("aws-cdk-lib");
const group_expenses_stack_ts_1 = require("../src/stacks/group-expenses-stack.ts");
const app = new aws_cdk_lib_1.App();
new group_expenses_stack_ts_1.GroupExpensesStack(app, "GroupExpensesStack", {
    env: {
        account: process.env.CDK_DEFAULT_ACCOUNT,
        region: process.env.CDK_DEFAULT_REGION
    }
});
app.synth();
