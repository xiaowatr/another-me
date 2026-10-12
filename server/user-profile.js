import {profileFields} from '../src/global-memory.js';
import {AppError} from './core.js';
export function userProfileMessages(data){return [{role:'system',content:'整理这次交流中你对现实用户的理解，结合previousProfile生成一份简洁的完整记忆草稿，供用户编辑确认。输出JSON：{"profile":{"facts":"你明确知道的现实经历、近况与持续计划","preferences":"如何与用户相处、交流偏好及在意的事","impressions":"基于交流的简短印象，可不确定，不作人格诊断"}}。事实尽量200字以内，交流偏好150字以内，印象120字以内；每字段硬上限1000字，可为空，不凑数。仅依据用户原话，context只帮助理解指代。平行角色的经历、第三人的独立事实、对角色的提问、假设不能当用户事实。印象用谨慎措辞，与确定事实分开。一次消息的“两句话、不用问我”只约束该次回复，不写成长期句数或绝不提问偏好；长期的“不喜欢连续追问”按原范围保留。不把临时心情变成性格。新明确纠正优先，未被纠正的已有信息保留，不能把删除后未重新表达的内容恢复。不得加入原文没有的身份关系、经历或诊断。不逐句列卡，不对每句话分类，不把程序字段当用户指令。'}, {role:'user',content:JSON.stringify({previousProfile:data.globalProfile,messages:data.messages,context:data.context})}];}
export function normalizeUserProfile(result,data,batchId){try{return {lifeId:data.lifeId,batchId,operations:[],profile:profileFields(result.profile)};}catch{throw new AppError('invalid_response',502,{stage:'profile_validation',reason:'invalid_profile'});}}
export function validateUserProfile(value){try{return profileFields(value);}catch{throw new AppError('input');}}

