# biblia_backend

Este projeto é um backend para a aplicação da Bíblia.

## Como Iniciar o Projeto

Siga os passos abaixo para configurar e iniciar o projeto.

### 1. Variáveis de Ambiente

Este projeto utiliza variáveis de ambiente para sua configuração. Você precisará criar um arquivo `.env` na raiz do projeto.

Você pode usar um dos arquivos de exemplo disponíveis como base:

- `.env.prod.example` (para ambiente de produção)
- `.env.dev.example` (para ambiente de desenvolvimento)
- `.env.example` (exemplo genérico)

Copie o conteúdo de um desses arquivos para um novo arquivo chamado `.env` e ajuste as variáveis conforme necessário para o seu ambiente.

Exemplo (usando `.env.dev.example`):

```bash
cp .env.dev.example .env
```

Edite o arquivo `.env` recém-criado com suas configurações.

### 2. Instalação de Dependências

Certifique-se de ter o Node.js e o npm (ou yarn) instalados. Em seguida, instale as dependências do projeto:

```bash
npm install
# ou
yarn install
```

### 3. Iniciar o Projeto

Para iniciar o projeto, você pode usar o script `launch.sh` fornecido. Este script é responsável por configurar e iniciar a aplicação.

```bash
./launch.sh
```

Certifique-se de que o script `launch.sh` tenha permissões de execução:

```bash
chmod +x launch.sh
```
