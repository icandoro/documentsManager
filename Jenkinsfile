pipeline {
    agent {
        kubernetes {
            defaultContainer 'php'

            yaml '''
apiVersion: v1
kind: Pod
spec:
  containers:
    - name: php
      image: composer:2
      command:
        - cat
      tty: true

    - name: node
      image: node:22-alpine
      command:
        - cat
      tty: true
'''
        }
    }

    options {
        timestamps()
        disableConcurrentBuilds()
    }

    stages {
        stage('Checkout') {
            steps {
                checkout scm
            }
        }

        stage('Backend dependencies') {
            steps {
                container('php') {
                    dir('backend') {
                        sh '''
                            composer install \
                              --no-interaction \
                              --prefer-dist \
                              --no-progress
                        '''
                    }
                }
            }
        }

        stage('Backend validation') {
            steps {
                container('php') {
                    dir('backend') {
                        sh '''
                            php bin/console lint:container
                            php bin/console lint:yaml config
                        '''
                    }
                }
            }
        }

        stage('Frontend dependencies') {
            steps {
                container('node') {
                    dir('frontend') {
                        sh 'npm ci'
                    }
                }
            }
        }

        stage('Frontend build') {
            steps {
                container('node') {
                    dir('frontend') {
                        sh 'npm run build'
                    }
                }
            }
        }
    }

    post {
        success {
            echo 'CI documentsManager finalizat cu succes.'
        }

        failure {
            echo 'CI documentsManager a esuat. Verifica etapa marcata cu rosu.'
        }
    }
}