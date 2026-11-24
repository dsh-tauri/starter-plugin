/// <reference types="node" />
import { defineWebServer } from 'dsh-h3'

export interface ServerOptions {

}

export const server = defineWebServer<ServerOptions>((_app) => {

})
