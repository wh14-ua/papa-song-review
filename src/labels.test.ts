import { describe, expect, it } from 'vitest'
import { questionLead } from './labels'

describe('questionLead', () => {
  it('deja solo la pregunta (las opciones A, B… ya se muestran como grupos)', () => {
    expect(
      questionLead(
        '您写的「一瞬间」是下面哪一首？请听一听再选：A. 《一瞬间》 丽江小倩 (2011) / B. 《一瞬间》 汪峰 (2011) / 都不是',
      ),
    ).toBe('是下面哪一首？请听一听再选')
  })

  it('funciona aunque el texto de papá sea una descripción larga', () => {
    expect(
      questionLead('您写的「射雕英雄传的插曲」是下面哪一首？请听一听再选：A. 《世间始终你好》 罗文、甄妮 (1983) / 都不是'),
    ).toBe('是下面哪一首？请听一听再选')
  })

  it('devuelve la pregunta completa cuando no hay lista de opciones', () => {
    const question = '「从相拥守着碎碎将来」没有找到对应的歌曲。您还记得歌名、歌手，或者能哼一句吗？'
    expect(questionLead(question)).toBe(question)
  })
})
